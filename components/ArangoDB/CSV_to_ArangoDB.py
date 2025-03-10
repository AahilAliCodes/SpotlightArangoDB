# from arango import ArangoClient
# import pandas as pd
# import numpy as np
# import os
# from datetime import datetime
# from config import ARANGO_HOST, ARANGO_USERNAME, ARANGO_PASSWORD

# ARANGO_DB = 'Gdelt_DB'

# def clean_value(value):
#     """Clean and validate values before insertion"""
#     if pd.isna(value) or value == '':
#         return None
#     elif isinstance(value, (np.int64, np.float64)):
#         return float(value) if isinstance(value, np.float64) else int(value)
#     else:
#         return str(value)
    
# def delete_collections():
#     # Connect to ArangoDB
#     db = ArangoClient(hosts=ARANGO_HOST).db(
#     username=ARANGO_USERNAME, 
#     password=ARANGO_PASSWORD, 
#     verify=True
# )
#     # Get all collections in the database
#     all_collections = db.collections()
    
#     # Delete each collection if it's not a system collection
#     for collection in all_collections:
#         # Skip system collections (they start with '_')
#         if not collection['name'].startswith('_'):
#             db.delete_collection(collection['name'])
#             print(f"Deleted collection: {collection['name']}")

# def connect_to_arango():
#     """Establish connection to ArangoDB and create database if it doesn't exist"""
#     sys_db = ArangoClient(hosts=ARANGO_HOST).db(
#     username=ARANGO_USERNAME, 
#     password=ARANGO_PASSWORD, 
#     verify=True
# )
    
#     if not sys_db.has_database(ARANGO_DB):
#         sys_db.create_database(ARANGO_DB)
    
#     db = ArangoClient(hosts=ARANGO_HOST).db(
#     username=ARANGO_USERNAME, 
#     password=ARANGO_PASSWORD, 
#     verify=True
# )
#     return db

# def setup_collections(db):
#     """Create necessary collections if they don't exist"""
#     collections = {}
    
#     # Vertex collections
#     for name in ['Events', 'Actors', 'Locations']:
#         if not db.has_collection(name):
#             collections[name.lower()] = db.create_collection(name)
#         else:
#             collections[name.lower()] = db.collection(name)
    
#     # Edge collection
#     if not db.has_collection('EventRelations'):
#         collections['relations'] = db.create_collection('EventRelations', edge=True)
#     else:
#         collections['relations'] = db.collection('EventRelations')
    
#     return collections

# def process_latest_csv():
#     """Process the most recent CSV file from the output directory"""
#     output_dir = "/Users/aahilali/Desktop/my-app/components/ArangoDBOutput"
    
#     csv_files = [f for f in os.listdir(output_dir) if f.endswith('.CSV')]
#     if not csv_files:
#         print("No CSV files found in output directory")
#         return None, None
    
#     latest_file = max([os.path.join(output_dir, f) for f in csv_files], 
#                      key=os.path.getmtime)
    
#     print(f"Processing file: {latest_file}")
#     df = pd.read_csv(latest_file)
    
#     # Convert numeric columns to appropriate types
#     numeric_columns = ['GlobalEventID', 'Day', 'MonthYear', 'Year', 'GoldsteinScale', 
#                       'NumMentions', 'NumSources', 'NumArticles', 'AvgTone', 
#                       'Actor1Geo_Lat', 'Actor1Geo_Long']
    
#     for col in numeric_columns:
#         if col in df.columns:
#             df[col] = pd.to_numeric(df[col], errors='coerce')
    
#     return df, latest_file

# def create_graph_data(df, collections):
#     """Convert DataFrame rows into graph components"""
#     # Clear existing data
#     for collection in collections.values():
#         collection.truncate()
    
#     for index, row in df.iterrows():
#         try:
#             # Create Event vertex
#             event_doc = {
#                 '_key': str(int(row['GlobalEventID'])),
#                 'eventCode': int(clean_value(row['EventCode'])),
#                 'baseCode': int(clean_value(row['EventBaseCode'])),
#                 'rootCode': int(clean_value(row['EventRootCode'])),
#                 'quadClass': int(clean_value(row['QuadClass'])),
#                 'goldsteinScale': float(clean_value(row['GoldsteinScale'])),
#                 'numMentions': int(clean_value(row['NumMentions'])),
#                 'numSources': int(clean_value(row['NumSources'])),
#                 'numArticles': int(clean_value(row['NumArticles'])),
#                 'avgTone': float(clean_value(row['AvgTone'])),
#                 'date': int(clean_value(row['Day'])),
#                 'year': int(clean_value(row['Year'])),
#                 'monthYear': int(clean_value(row['MonthYear'])),
#                 'fractionDate': str(clean_value(row['FractionDate'])),
#                 'source': str(row['Source'])
#             }
            
#             # Remove None values
#             event_doc = {k: v for k, v in event_doc.items() if v is not None}
            
#             print(f"Inserting event {index + 1}: {event_doc['_key']}")
#             collections['events'].insert(event_doc)
            
#             # Create Actor vertex
#             actor_key = f"actor_{str(int(row['GlobalEventID']))}"
#             actor_doc = {
#                 '_key': actor_key,
#                 'type1Code': clean_value(row['Actor1Type1Code']),
#                 'type2Code': clean_value(row['Actor1Type2Code']),
#                 'type3Code': clean_value(row['Actor1Type3Code']),
#                 'countryCode': clean_value(row['Actor1CountryCode'])
#             }
            
#             # Remove None values
#             actor_doc = {k: v for k, v in actor_doc.items() if v is not None}
#             collections['actors'].insert(actor_doc)
            
#             # Create Location vertex if coordinates exist
#             if pd.notna(row['Actor1Geo_Lat']) and pd.notna(row['Actor1Geo_Long']):
#                 location_key = f"loc_{str(int(row['GlobalEventID']))}"
#                 location_doc = {
#                     '_key': location_key,
#                     'type': clean_value(row['Actor1Geo_Type']),
#                     'fullname': clean_value(row['Actor1Geo_Fullname']),
#                     'countryCode': clean_value(row['Actor1Geo_CountryCode']),
#                     'adm1Code': clean_value(row['Actor1Geo_ADM1Code']),
#                     'adm2Code': clean_value(row['Actor1Geo_ADM2Code']),
#                     'latitude': float(clean_value(row['Actor1Geo_Lat'])),
#                     'longitude': float(clean_value(row['Actor1Geo_Long'])),
#                     'featureID': clean_value(row['Actor1Geo_FeatureID'])
#                 }
                
#                 # Remove None values
#                 location_doc = {k: v for k, v in location_doc.items() if v is not None}
#                 collections['locations'].insert(location_doc)
                
#                 # Create edge between Event and Location
#                 edge_doc = {
#                     '_from': f"Events/{str(int(row['GlobalEventID']))}",
#                     '_to': f"Locations/{location_key}",
#                     'type': 'OCCURRED_AT'
#                 }
#                 collections['relations'].insert(edge_doc)
            
#             # Create edge between Event and Actor
#             edge_doc = {
#                 '_from': f"Events/{str(int(row['GlobalEventID']))}",
#                 '_to': f"Actors/{actor_key}",
#                 'type': 'HAS_ACTOR'
#             }
#             collections['relations'].insert(edge_doc)
            
#         except Exception as e:
#             print(f"Error processing row {index + 1}: {str(e)}")
#             print(f"Row data: {row.to_dict()}")
#             continue

# def main():
#     try:
#         print("Connecting to ArangoDB...")
#         db = connect_to_arango()

#         # print("Deleting collections...")
#         # delete_collections()
#         # print("Collections deleted successfully!")
        
#         print("Setting up collections...")
#         collections = setup_collections(db)
        
#         print("Processing CSV file...")
#         df, csv_file_path = process_latest_csv()
#         if df is None:
#             return
        
#         print("Creating graph data...")
#         create_graph_data(df, collections)
        
#         print("Graph database successfully created!")
#         print(f"Total events processed: {len(df)}")
        
#         # Delete the processed CSV file
#         if csv_file_path and os.path.exists(csv_file_path):
#             os.remove(csv_file_path)
#             print(f"Deleted processed file: {csv_file_path}")
        
#     except Exception as e:
#         print(f"Error: {str(e)}")
#         import traceback
#         print(traceback.format_exc())

# if __name__ == "__main__":
#     main()

from arango import ArangoClient
import pandas as pd
import numpy as np
import os
import matplotlib.pyplot as plt
import networkx as nx
from matplotlib.colors import ListedColormap
import random
from config import ARANGO_HOST, ARANGO_USERNAME, ARANGO_PASSWORD

ARANGO_DB = 'Gdelt_DB'

def connect_to_arango():
    """Establish connection to ArangoDB"""
    client = ArangoClient(hosts=ARANGO_HOST)
    db = client.db(ARANGO_DB, username=ARANGO_USERNAME, password=ARANGO_PASSWORD, verify=True)
    return db

def get_graph_data(db, limit=50):
    """Retrieve graph data from ArangoDB collections instead of using the named graph"""
    # Create NetworkX graph
    G = nx.Graph()
    
    # Get a sample of events
    events_query = """
    FOR e IN Events
    SORT RAND()
    LIMIT @limit
    RETURN e
    """
    
    event_cursor = db.aql.execute(events_query, bind_vars={"limit": limit})
    events = list(event_cursor)
    
    # Add event nodes
    for event in events:
        event_id = f"Events/{event['_key']}"
        G.add_node(event_id, 
                  type="Events", 
                  quadClass=event.get('quadClass'),
                  eventCode=event.get('eventCode'),
                  key=event['_key'])
    
    # Create a list of event IDs for our query
    event_ids = [event['_key'] for event in events]
    
    # Get actors related to these events
    actors_query = """
    FOR rel IN EventRelations
        FILTER rel._from IN @event_ids
        FOR actor IN Actors
            FILTER rel._to == actor._id
            RETURN {
                "event_id": rel._from,
                "actor": actor,
                "relation": rel
            }
    """
    
    actors_cursor = db.aql.execute(actors_query, 
                                   bind_vars={"event_ids": [f"Events/{e}" for e in event_ids]})
    
    for item in actors_cursor:
        actor = item['actor']
        actor_id = actor['_id']
        
        # Add actor node if it doesn't exist
        if not G.has_node(actor_id):
            G.add_node(actor_id, 
                      type="Actors", 
                      key=actor['_key'],
                      **{k: v for k, v in actor.items() if k not in ['_id', '_key', '_rev']})
        
        # Add edge between event and actor
        G.add_edge(item['event_id'], 
                  actor_id, 
                  type=item['relation'].get('type', 'HAS_ACTOR'),
                  key=item['relation']['_key'])
    
    # Get locations related to these events
    locations_query = """
    FOR rel IN EventRelations
        FILTER rel._from IN @event_ids
        FOR location IN Locations
            FILTER rel._to == location._id
            RETURN {
                "event_id": rel._from,
                "location": location,
                "relation": rel
            }
    """
    
    locations_cursor = db.aql.execute(locations_query, 
                                    bind_vars={"event_ids": [f"Events/{e}" for e in event_ids]})
    
    for item in locations_cursor:
        location = item['location']
        location_id = location['_id']
        
        # Add location node if it doesn't exist
        if not G.has_node(location_id):
            G.add_node(location_id, 
                      type="Locations", 
                      key=location['_key'],
                      **{k: v for k, v in location.items() if k not in ['_id', '_key', '_rev']})
        
        # Add edge between event and location
        G.add_edge(item['event_id'], 
                  location_id, 
                  type=item['relation'].get('type', 'OCCURRED_AT'),
                  key=item['relation']['_key'])
    
    # Try to get countries if they exist
    try:
        countries_query = """
        FOR c IN Countries
        RETURN c
        """
        countries_cursor = db.aql.execute(countries_query)
        countries = list(countries_cursor)
        
        # Add country nodes
        for country in countries:
            country_id = country['_id']
            G.add_node(country_id, 
                      type="Countries", 
                      key=country['_key'],
                      code=country.get('code', country['_key']))
        
        # Try to get country relations if they exist
        try:
            country_rels_query = """
            FOR rel IN CountryRelations
                RETURN rel
            """
            country_rels_cursor = db.aql.execute(country_rels_query)
            
            for rel in country_rels_cursor:
                if G.has_node(rel['_from']) and G.has_node(rel['_to']):
                    G.add_edge(rel['_from'], 
                             rel['_to'], 
                             type=rel.get('type', 'RELATED_TO'),
                             key=rel['_key'])
        except:
            print("CountryRelations collection might not exist or is empty")
    
    except:
        print("Countries collection might not exist or is empty")
    
    # Try to get QuadClasses if they exist
    try:
        quadclasses_query = """
        FOR q IN QuadClasses
        RETURN q
        """
        quadclasses_cursor = db.aql.execute(quadclasses_query)
        quadclasses = list(quadclasses_cursor)
        
        # Add quadclass nodes
        for quadclass in quadclasses:
            quadclass_id = quadclass['_id']
            G.add_node(quadclass_id, 
                      type="QuadClasses", 
                      key=quadclass['_key'],
                      description=quadclass.get('description', ''))
        
        # Connect events to their quadclasses
        for event_id, event_data in G.nodes(data=True):
            if event_data.get('type') == 'Events' and 'quadClass' in event_data:
                quadclass_key = str(event_data['quadClass'])
                quadclass_id = f"QuadClasses/{quadclass_key}"
                
                if G.has_node(quadclass_id):
                    G.add_edge(event_id, 
                              quadclass_id, 
                              type='HAS_QUADCLASS')
    
    except:
        print("QuadClasses collection might not exist or is empty")
    
    # Try to get ActorType3Codes if they exist
    try:
        type3codes_query = """
        FOR t IN ActorType3Codes
        RETURN t
        """
        type3codes_cursor = db.aql.execute(type3codes_query)
        type3codes = list(type3codes_cursor)
        
        # Add type3code nodes
        for type3code in type3codes:
            type3code_id = type3code['_id']
            G.add_node(type3code_id, 
                      type="ActorType3Codes", 
                      key=type3code['_key'],
                      code=type3code.get('code', type3code['_key']))
        
        # Try to get type relations if they exist
        try:
            type_rels_query = """
            FOR rel IN TypeRelations
                RETURN rel
            """
            type_rels_cursor = db.aql.execute(type_rels_query)
            
            for rel in type_rels_cursor:
                if G.has_node(rel['_from']) and G.has_node(rel['_to']):
                    G.add_edge(rel['_from'], 
                             rel['_to'], 
                             type=rel.get('type', 'RELATED_TO'),
                             key=rel['_key'])
        except:
            print("TypeRelations collection might not exist or is empty")
            
        # Connect actors to their type3codes based on attribute
        for node_id, node_data in list(G.nodes(data=True)):
            if node_data.get('type') == 'Actors' and 'type3Code' in node_data:
                type3code = node_data['type3Code']
                type3code_id = f"ActorType3Codes/{type3code}"
                
                if G.has_node(type3code_id):
                    G.add_edge(node_id, 
                              type3code_id, 
                              type='HAS_TYPE')
    
    except:
        print("ActorType3Codes collection might not exist or is empty")
    
    return G

def visualize_graph(G, output_file="gdelt_graph.png"):
    """Visualize the graph with node colors by type and save to file"""
    plt.figure(figsize=(20, 16))
    
    # Define node colors by type
    color_map = {
        'Events': 'tab:red',
        'Actors': 'tab:blue',
        'Locations': 'tab:green',
        'Countries': 'tab:purple',
        'QuadClasses': 'tab:orange',
        'ActorType3Codes': 'tab:brown'
    }
    
    # Get all node types
    node_types = set(nx.get_node_attributes(G, 'type').values())
    
    # Create position layout - use spring layout with more space
    pos = nx.spring_layout(G, k=0.3, iterations=50, seed=42)
    
    # Draw nodes by type
    for node_type in node_types:
        # Get nodes of this type
        nodes = [n for n, d in G.nodes(data=True) if d.get('type') == node_type]
        if not nodes:
            continue
            
        nx.draw_networkx_nodes(
            G, pos, 
            nodelist=nodes,
            node_color=color_map.get(node_type, 'tab:gray'),
            node_size=300 if node_type == 'Events' else 200,
            alpha=0.8,
            label=node_type
        )
    
    # Draw edges with varying styles by type
    edge_types = set(nx.get_edge_attributes(G, 'type').values())
    edge_styles = ['solid', 'dashed', 'dotted', 'dashdot']
    edge_type_style = {}
    
    for i, edge_type in enumerate(edge_types):
        edge_type_style[edge_type] = edge_styles[i % len(edge_styles)]
    
    for edge_type in edge_types:
        edges = [(u, v) for u, v, d in G.edges(data=True) if d.get('type') == edge_type]
        if not edges:
            continue
            
        nx.draw_networkx_edges(
            G, pos,
            edgelist=edges,
            width=1.0,
            alpha=0.5,
            edge_color='gray',
            style=edge_type_style.get(edge_type, 'solid')
        )
    
    # Add labels for a subset of nodes to avoid overcrowding
    # Label a random subset of each node type
    labels = {}
    for node_type in node_types:
        # Get nodes of this type
        nodes_of_type = [n for n, d in G.nodes(data=True) if d.get('type') == node_type]
        
        # Choose a sampling ratio based on node type
        if node_type == 'Events':
            sampling_ratio = 0.1  # Label 10% of events
        elif node_type in ['Countries', 'QuadClasses', 'ActorType3Codes']:
            sampling_ratio = 1.0  # Label all of these important node types
        else:
            sampling_ratio = 0.2  # Label 20% of other nodes
        
        # Sample nodes to label
        nodes_to_label = random.sample(
            nodes_of_type, 
            k=min(int(len(nodes_of_type) * sampling_ratio) + 1, len(nodes_of_type))
        )
        
        # Create labels based on node type
        for n in nodes_to_label:
            node_data = G.nodes[n]
            
            if node_type == 'Events':
                labels[n] = f"E:{node_data.get('eventCode', n.split('/')[-1])}"
            elif node_type == 'Countries':
                labels[n] = f"C:{node_data.get('code', n.split('/')[-1])}"
            elif node_type == 'QuadClasses':
                labels[n] = f"Q:{node_data.get('description', n.split('/')[-1])}"
            elif node_type == 'ActorType3Codes':
                labels[n] = f"T:{node_data.get('code', n.split('/')[-1])}"
            elif node_type == 'Actors':
                labels[n] = f"A:{node_data.get('countryCode', '')}"
            elif node_type == 'Locations':
                labels[n] = f"L:{node_data.get('fullname', '').split(',')[0] if node_data.get('fullname') else ''}"
    
    # Draw labels with white background for readability
    label_options = {"bbox": {"boxstyle": "round,pad=0.3", "facecolor": "white", "alpha": 0.6},
                    "font_size": 8,
                    "font_weight": "bold"}
    nx.draw_networkx_labels(G, pos, labels=labels, **label_options)
    
    # Add graph stats in a text box
    stats_text = (
        f"Graph Statistics:\n"
        f"Nodes: {G.number_of_nodes()}\n"
        f"Edges: {G.number_of_edges()}\n"
        f"Node Types: {len(node_types)}\n"
        f"Edge Types: {len(edge_types)}"
    )
    
    plt.figtext(0.02, 0.02, stats_text, fontsize=12,
              bbox={"boxstyle": "round,pad=0.5", "facecolor": "white", "alpha": 0.8})
    
    # Create a legend for node types
    plt.legend(scatterpoints=1, loc='upper right', ncol=1)
    
    # Create a custom legend for edge types
    from matplotlib.lines import Line2D
    edge_legend_elements = [
        Line2D([0], [0], color='gray', lw=2, label=edge_type, 
              linestyle=edge_type_style.get(edge_type, 'solid'))
        for edge_type in edge_types
    ]
    
    # Place the edge legend
    edge_legend = plt.legend(handles=edge_legend_elements, 
                           loc='upper left', 
                           title="Edge Types",
                           fontsize=8)
    plt.gca().add_artist(edge_legend)
    
    plt.title("GDELT Complex Graph Visualization", fontsize=20)
    plt.axis('off')
    plt.tight_layout()
    
    # Save figure
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Graph visualization saved to {output_file}")
    
    # Also display in the figure
    plt.show()

def analyze_graph(G):
    """Analyze graph structure and print statistics"""
    print("\n--- Graph Analysis ---")
    print(f"Total nodes: {G.number_of_nodes()}")
    print(f"Total edges: {G.number_of_edges()}")
    
    # Count nodes by type
    node_types = {}
    for _, data in G.nodes(data=True):
        node_type = data.get('type', 'Unknown')
        node_types[node_type] = node_types.get(node_type, 0) + 1
    
    print("\nNode counts by type:")
    for node_type, count in sorted(node_types.items()):
        print(f"- {node_type}: {count}")
    
    # Count edges by type
    edge_types = {}
    for _, _, data in G.edges(data=True):
        edge_type = data.get('type', 'Unknown')
        edge_types[edge_type] = edge_types.get(edge_type, 0) + 1
    
    print("\nEdge counts by type:")
    for edge_type, count in sorted(edge_types.items()):
        print(f"- {edge_type}: {count}")
    
    # Calculate average degree
    degrees = [d for _, d in G.degree()]
    avg_degree = sum(degrees) / len(degrees) if degrees else 0
    print(f"\nAverage node degree: {avg_degree:.2f}")
    
    # Find most connected nodes by type
    print("\nMost connected nodes by type:")
    for node_type in sorted(node_types.keys()):
        nodes_of_type = [(n, d) for n, d in G.degree() 
                         if G.nodes[n].get('type') == node_type]
        if nodes_of_type:
            most_connected = max(nodes_of_type, key=lambda x: x[1])
            print(f"- {node_type}: {most_connected[0]} with {most_connected[1]} connections")

def main():
    try:
        print("Connecting to ArangoDB...")
        db = connect_to_arango()
        
        print("Retrieving graph data from collections...")
        G = get_graph_data(db, limit=75)  # Limit to 75 events for better visualization
        
        print("Analyzing graph...")
        analyze_graph(G)
        
        print("Visualizing graph...")
        visualize_graph(G, output_file="gdelt_complex_graph.png")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        print(traceback.format_exc())

if __name__ == "__main__":
    main()