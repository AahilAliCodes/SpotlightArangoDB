import argparse
from arango import ArangoClient
import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt
from langchain_community.chains.graph_qa.arangodb import ArangoGraphQAChain
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
import os
import json
import re
from functools import wraps

# Load environment variables for API keys
load_dotenv()

# Database configuration - replace with your own or load from config
ARANGO_HOST = os.getenv("ARANGO_HOST", "http://localhost:8529")
ARANGO_USERNAME = os.getenv("ARANGO_USERNAME", "root")
ARANGO_PASSWORD = os.getenv("ARANGO_PASSWORD", "")
ARANGO_DB = os.getenv("ARANGO_DB", "Gdelt_DB")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

def connect_to_arango():
    """Establish connection to ArangoDB and return the database object"""
    try:
        client = ArangoClient(hosts=ARANGO_HOST)
        db = client.db(ARANGO_DB, username=ARANGO_USERNAME, password=ARANGO_PASSWORD, verify=True)
        print(f"Successfully connected to ArangoDB: {ARANGO_DB}")
        return db
    except Exception as e:
        print(f"Error connecting to ArangoDB: {str(e)}")
        return None

def get_collections_info(db):
    """Get information about all collections in the database"""
    collections = {}
    for collection in db.collections():
        if not collection['name'].startswith('_'):
            collections[collection['name']] = {
                'type': collection['type'],
                'count': db.collection(collection['name']).count()
            }
    return collections

def execute_aql_query(db, query, bind_vars=None):
    """Execute an AQL query and return the results"""
    try:
        cursor = db.aql.execute(query, bind_vars=bind_vars)
        results = [doc for doc in cursor]
        return results
    except Exception as e:
        print(f"Error executing AQL query: {str(e)}")
        return []

def query_events(db, limit=10, filters=None):
    """Query events with optional filters"""
    bind_vars = {"@collection": "Events", "limit": limit}
    filter_clause = ""
    
    if filters:
        filter_conditions = []
        for key, value in filters.items():
            if key in bind_vars:
                # Avoid name collisions in bind variables
                bind_key = f"{key}_{len(bind_vars)}"
            else:
                bind_key = key
            bind_vars[bind_key] = value
            filter_conditions.append(f"doc.{key} == @{bind_key}")
        
        if filter_conditions:
            filter_clause = "FILTER " + " AND ".join(filter_conditions)
    
    query = f"""
    FOR doc IN @@collection
    {filter_clause}
    LIMIT @limit
    RETURN doc
    """
    
    return execute_aql_query(db, query, bind_vars)

def query_actors(db, limit=10, filters=None):
    """Query actors with optional filters"""
    bind_vars = {"@collection": "Actors", "limit": limit}
    filter_clause = ""
    
    if filters:
        filter_conditions = []
        for key, value in filters.items():
            if key in bind_vars:
                bind_key = f"{key}_{len(bind_vars)}"
            else:
                bind_key = key
            bind_vars[bind_key] = value
            filter_conditions.append(f"doc.{key} == @{bind_key}")
        
        if filter_conditions:
            filter_clause = "FILTER " + " AND ".join(filter_conditions)
    
    query = f"""
    FOR doc IN @@collection
    {filter_clause}
    LIMIT @limit
    RETURN doc
    """
    
    return execute_aql_query(db, query, bind_vars)

def query_locations(db, limit=10, filters=None):
    """Query locations with optional filters"""
    bind_vars = {"@collection": "Locations", "limit": limit}
    filter_clause = ""
    
    if filters:
        filter_conditions = []
        for key, value in filters.items():
            if key in bind_vars:
                bind_key = f"{key}_{len(bind_vars)}"
            else:
                bind_key = key
            bind_vars[bind_key] = value
            filter_conditions.append(f"doc.{key} == @{bind_key}")
        
        if filter_conditions:
            filter_clause = "FILTER " + " AND ".join(filter_conditions)
    
    query = f"""
    FOR doc IN @@collection
    {filter_clause}
    LIMIT @limit
    RETURN doc
    """
    
    return execute_aql_query(db, query, bind_vars)

def query_events_with_relations(db, event_id, limit=10):
    """Get an event and its related actors and locations"""
    query = """
    LET event = DOCUMENT(CONCAT('Events/', @event_id))
    
    LET actor_relations = (
        FOR edge IN EventRelations
        FILTER edge._from == event._id AND edge.type == 'HAS_ACTOR'
        FOR actor IN Actors
        FILTER edge._to == actor._id
        RETURN actor
    )
    
    LET location_relations = (
        FOR edge IN EventRelations
        FILTER edge._from == event._id AND edge.type == 'OCCURRED_AT'
        FOR location IN Locations
        FILTER edge._to == location._id
        RETURN location
    )
    
    RETURN {
        event: event,
        actors: actor_relations,
        locations: location_relations
    }
    """
    
    return execute_aql_query(db, query, {"event_id": event_id})

def get_network_graph(db, event_limit=100):
    """Create a NetworkX graph from ArangoDB data"""
    # Initialize a NetworkX Graph
    G = nx.Graph()
    
    # Get a limited number of events
    events = query_events(db, limit=event_limit)
    
    # Add event nodes
    for event in events:
        G.add_node(event['_id'], type='event', **event)
    
    # Get relations for these events
    event_ids = [event['_key'] for event in events]
    relations_query = """
    FOR event_id IN @event_ids
        LET event_doc_id = CONCAT('Events/', event_id)
        
        FOR edge IN EventRelations
            FILTER edge._from == event_doc_id
            LET target_node = DOCUMENT(edge._to)
            
            RETURN {
                from: edge._from,
                to: edge._to,
                type: edge.type,
                target_type: PARSE_IDENTIFIER(edge._to).collection
            }
    """
    
    relations = execute_aql_query(db, relations_query, {"event_ids": event_ids})
    
    # Add related nodes and edges
    for relation in relations:
        # Add the target node if not already in the graph
        if not G.has_node(relation['to']):
            # Get the full node document
            node_query = "RETURN DOCUMENT(@id)"
            node_doc = execute_aql_query(db, node_query, {"id": relation['to']})
            if node_doc:
                G.add_node(relation['to'], type=relation['target_type'], **node_doc[0])
            else:
                # Fallback if can't get the complete document
                G.add_node(relation['to'], type=relation['target_type'])
        
        # Add the edge
        G.add_edge(relation['from'], relation['to'], type=relation['type'])
    
    return G

def visualize_graph(G, output_file=None):
    """Visualize a NetworkX graph"""
    plt.figure(figsize=(12, 8))
    
    # Create node colors based on type
    node_colors = []
    for node in G.nodes():
        node_type = G.nodes[node].get('type', '')
        if node_type == 'event':
            node_colors.append('red')
        elif node_type == 'Actors':
            node_colors.append('blue')
        elif node_type == 'Locations':
            node_colors.append('green')
        else:
            node_colors.append('gray')
    
    # Create a spring layout for the graph
    pos = nx.spring_layout(G, seed=42)
    
    # Draw the network
    nx.draw(G, pos, node_color=node_colors, with_labels=False, node_size=50, alpha=0.7)
    
    # Draw a smaller set of node labels for readability
    labels = {node: node.split('/')[-1] for node in list(G.nodes())[:20]}
    nx.draw_networkx_labels(G, pos, labels=labels, font_size=8)
    
    # Add a legend
    legend_elements = [
        plt.Line2D([0], [0], marker='o', color='w', label='Event', markerfacecolor='red', markersize=10),
        plt.Line2D([0], [0], marker='o', color='w', label='Actor', markerfacecolor='blue', markersize=10),
        plt.Line2D([0], [0], marker='o', color='w', label='Location', markerfacecolor='green', markersize=10)
    ]
    plt.legend(handles=legend_elements)
    
    plt.title('GDELT Event Network')
    
    if output_file:
        plt.savefig(output_file)
        print(f"Graph visualization saved to {output_file}")
    else:
        plt.show()

def find_similar_events(db, event_id, limit=5):
    """Find events similar to a given event"""
    query = """
    LET event = DOCUMENT(CONCAT('Events/', @event_id))
    
    FOR e IN Events
        FILTER e._id != event._id
        LET similarity = (
            (e.eventCode == event.eventCode ? 1 : 0) + 
            (e.quadClass == event.quadClass ? 1 : 0) +
            (ABS(e.goldsteinScale - event.goldsteinScale) < 1 ? 1 : 0) +
            (ABS(e.avgTone - event.avgTone) < 5 ? 1 : 0)
        )
        SORT similarity DESC
        LIMIT @limit
        RETURN {
            event: e,
            similarity_score: similarity
        }
    """
    
    return execute_aql_query(db, query, {"event_id": event_id, "limit": limit})

def get_event_time_distribution(db, timespan=30):
    """Get event distribution over time"""
    query = """
    FOR e IN Events
        COLLECT day = e.date
        WITH COUNT INTO count
        SORT day
        LIMIT @timespan
        RETURN {
            day: day,
            count: count
        }
    """
    
    results = execute_aql_query(db, query, {"timespan": timespan})
    
    # Convert to pandas DataFrame for easier manipulation
    if results:
        df = pd.DataFrame(results)
        return df
    return pd.DataFrame()

def natural_language_query(db, query_text):
    """Use LangChain and ArangoGraphQAChain to process natural language queries"""
    try:
        # Check if OpenAI API key is set
        if not OPENAI_API_KEY:
            return {"error": "OpenAI API key not set. Please set the OPENAI_API_KEY environment variable."}
        
        llm = ChatOpenAI(temperature=0, model_name="gpt-4")
        
        # Create a Graph object for ArangoGraphQAChain
        # Note: This is a simplified version, you may need to customize the graph schema
        from langchain_community.graphs import ArangoGraph
        arango_graph = ArangoGraph(db)
        
        # Create the chain
        chain = ArangoGraphQAChain.from_llm(
            llm=llm,
            graph=arango_graph,
            verbose=True,
            allow_dangerous_requests=True
        )
        
        # Execute the query
        result = chain.invoke({"query": query_text})
        return result
    except Exception as e:
        print(f"Error processing natural language query: {str(e)}")
        return {"error": str(e)}

def main():
    parser = argparse.ArgumentParser(description='GDELT Database Query Tool')
    parser.add_argument('command', choices=['events', 'actors', 'locations', 'graph', 'nl-query'], 
                        help='Command to execute')
    parser.add_argument('--limit', type=int, default=10, help='Maximum number of results')
    parser.add_argument('--filters', type=str, help='JSON string of filters, e.g., \'{"eventCode": 20}\' for events')
    parser.add_argument('--event-id', type=str, help='Event ID for relations or similar events')
    parser.add_argument('--output', type=str, help='Output file for graph visualization')
    parser.add_argument('--query', type=str, help='Natural language query text')
    
    args = parser.parse_args()
    
    # Connect to the database
    db = connect_to_arango()
    if not db:
        return
    
    # Parse filters if provided
    filters = None
    if args.filters:
        try:
            filters = json.loads(args.filters)
        except json.JSONDecodeError:
            print("Error: filters must be a valid JSON string")
            return
    
    # Execute the requested command
    if args.command == 'events':
        results = query_events(db, args.limit, filters)
        print(f"\nEvents (limit: {args.limit}):")
        for i, result in enumerate(results):
            print(f"\n--- Event {i+1} ---")
            print(json.dumps(result, indent=2))
    
    elif args.command == 'actors':
        results = query_actors(db, args.limit, filters)
        print(f"\nActors (limit: {args.limit}):")
        for i, result in enumerate(results):
            print(f"\n--- Actor {i+1} ---")
            print(json.dumps(result, indent=2))
    
    elif args.command == 'locations':
        results = query_locations(db, args.limit, filters)
        print(f"\nLocations (limit: {args.limit}):")
        for i, result in enumerate(results):
            print(f"\n--- Location {i+1} ---")
            print(json.dumps(result, indent=2))
    
    elif args.command == 'graph':
        print("Generating graph visualization...")
        G = get_network_graph(db, args.limit)
        print(f"Graph created with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
        visualize_graph(G, args.output)
    
    elif args.command == 'nl-query':
        if not args.query:
            print("Error: --query parameter is required for nl-query command")
            return
        
        print(f"Processing natural language query: {args.query}")
        result = natural_language_query(db, args.query)
        print("\nQuery Result:")
        print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()