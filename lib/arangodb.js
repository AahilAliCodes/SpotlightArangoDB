// lib/arangodb.js
import { ArangoGraph } from "langchain-community/graphs";
import { ArangoGraphQAChain } from "langchain/chains";
import { ChatOpenAI } from "langchain-openai";

// Initialize Langchain for ArangoDB collections
export const initLangchainComponents = async (db) => {
  try {
    // Create ArangoGraph instance
    const graph = new ArangoGraph(db);
    
    // Set the schema manually based on the collections setup in Python
    const manualSchema = {
      "Graph Schema": [
        {
          "graph_name": "EventsGraph",
          "edge_definitions": [
            {
              "edge_collection": "EventRelations",
              "from_vertex_collections": ["Events"],
              "to_vertex_collections": ["Actors", "Locations"]
            }
          ]
        }
      ],
      "Collection Schema": [
        {
          "collection_name": "Events",
          "collection_type": "document",
          "document_properties": [
            { "name": "_key", "type": "str" },
            { "name": "_id", "type": "str" },
            { "name": "eventCode", "type": "int" },
            { "name": "baseCode", "type": "int" },
            { "name": "rootCode", "type": "int" },
            { "name": "quadClass", "type": "int" },
            { "name": "goldsteinScale", "type": "float" },
            { "name": "numMentions", "type": "int" },
            { "name": "numSources", "type": "int" },
            { "name": "numArticles", "type": "int" },
            { "name": "avgTone", "type": "float" },
            { "name": "date", "type": "int" },
            { "name": "year", "type": "int" },
            { "name": "monthYear", "type": "int" },
            { "name": "fractionDate", "type": "str" },
            { "name": "source", "type": "str" }
          ]
        },
        {
          "collection_name": "Actors",
          "collection_type": "document",
          "document_properties": [
            { "name": "_key", "type": "str" },
            { "name": "_id", "type": "str" },
            { "name": "type1Code", "type": "str" },
            { "name": "type2Code", "type": "str" },
            { "name": "type3Code", "type": "str" },
            { "name": "countryCode", "type": "str" }
          ]
        },
        {
          "collection_name": "Locations",
          "collection_type": "document",
          "document_properties": [
            { "name": "_key", "type": "str" },
            { "name": "_id", "type": "str" },
            { "name": "type", "type": "str" },
            { "name": "fullname", "type": "str" },
            { "name": "countryCode", "type": "str" },
            { "name": "adm1Code", "type": "str" },
            { "name": "adm2Code", "type": "str" },
            { "name": "latitude", "type": "float" },
            { "name": "longitude", "type": "float" },
            { "name": "featureID", "type": "str" }
          ]
        },
        {
          "collection_name": "EventRelations",
          "collection_type": "edge",
          "edge_properties": [
            { "name": "_key", "type": "str" },
            { "name": "_id", "type": "str" },
            { "name": "_from", "type": "str" },
            { "name": "_to", "type": "str" },
            { "name": "type", "type": "str" }
          ]
        }
      ]
    };
    
    // Set schema manually instead of using auto-generation
    graph.schema = manualSchema;
    
    // Initialize OpenAI client
    const llm = new ChatOpenAI({
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Custom AQL examples to help the model understand the data structure
    const aqlExamples = `
# Find all events in the US
FOR loc IN Locations
  FILTER loc.countryCode == "US"
  FOR e IN EventRelations
    FILTER e._to == CONCAT("Locations/", loc._key)
    FOR ev IN Events
      FILTER e._from == CONCAT("Events/", ev._key)
      RETURN {
        quadclass: ev.quadClass,
        goldsteinscore: ev.goldsteinScale,
        source: ev.source,
        fullname: loc.fullname,
        countryCode: loc.countryCode,
        coordinates: [loc.latitude, loc.longitude]
      }

# Find all verbal cooperation events (quadClass 1)
FOR ev IN Events
  FILTER ev.quadClass == 1
  FOR e IN EventRelations
    FILTER e._from == CONCAT("Events/", ev._key) AND e._to LIKE "Locations/%"
    FOR loc IN Locations
      FILTER CONCAT("Locations/", loc._key) == e._to
      RETURN {
        quadclass: ev.quadClass,
        goldsteinscore: ev.goldsteinScale,
        source: ev.source,
        fullname: loc.fullname,
        countryCode: loc.countryCode,
        coordinates: [loc.latitude, loc.longitude]
      }

# Find all material conflict events (quadClass 4)
FOR ev IN Events
  FILTER ev.quadClass == 4
  FOR e IN EventRelations
    FILTER e._from == CONCAT("Events/", ev._key) AND e._to LIKE "Locations/%"
    FOR loc IN Locations
      FILTER CONCAT("Locations/", loc._key) == e._to
      RETURN {
        quadclass: ev.quadClass,
        goldsteinscore: ev.goldsteinScale,
        source: ev.source,
        fullname: loc.fullname,
        countryCode: loc.countryCode,
        coordinates: [loc.latitude, loc.longitude]
      }

# Find events with high Goldstein scores (above 5)
FOR ev IN Events
  FILTER ev.goldsteinScale > 5
  FOR e IN EventRelations
    FILTER e._from == CONCAT("Events/", ev._key) AND e._to LIKE "Locations/%"
    FOR loc IN Locations
      FILTER CONCAT("Locations/", loc._key) == e._to
      RETURN {
        quadclass: ev.quadClass,
        goldsteinscore: ev.goldsteinScale,
        source: ev.source,
        fullname: loc.fullname,
        countryCode: loc.countryCode,
        coordinates: [loc.latitude, loc.longitude]
      }
`;
    
    // Create ArangoGraphQAChain with custom settings
    const chain = ArangoGraphQAChain.from_llm(llm, graph, {
      verbose: process.env.NODE_ENV === 'development',
      return_aql_query: true,
      return_aql_result: true,
      aql_examples: aqlExamples,
      top_k: 100,
      max_aql_generation_attempts: 3
    });
    
    return chain;
  } catch (error) {
    console.error("Error initializing Langchain components:", error);
    throw error;
  }
};

// Process natural language query
export const processNaturalLanguageQuery = async (chain, query) => {
  try {
    // Check if it's a direct question (has question mark)
    const isDirectQuestion = query.includes('?');
    
    // If it's a direct question, ensure the query is well-formed for the LLM
    let processedQuery = query;
    if (isDirectQuestion) {
      // Make sure the query ends with a question mark
      if (!query.trim().endsWith('?')) {
        processedQuery = query.trim() + '?';
      }
      
      // For yes/no questions, add context to help the LLM generate better AQL
      if (/^(is|are|do|does|did|has|have|can|could|should|would|will)/i.test(query)) {
        processedQuery = `Based on the events data, ${processedQuery}`;
      }
    }
    
    console.log(`Processing query: ${processedQuery}`);
    const chainResult = await chain.call({
      query: processedQuery
    });
    
    // Format the output to match what the frontend expects
    const result = {
      answer: chainResult.result || chainResult.text || "I processed your query but couldn't generate a specific answer.",
      aqlQuery: chainResult.aql_query || null,
      aqlResult: chainResult.aql_result || []
    };
    
    // Post-process results to match the expected format
    if (result.aqlResult && Array.isArray(result.aqlResult)) {
      // Make sure each result has the expected fields
      result.aqlResult = result.aqlResult.map(item => {
        // Convert coordinates if they're in different format
        let coordinates = item.coordinates;
        if (!coordinates && item.latitude && item.longitude) {
          coordinates = [item.latitude, item.longitude];
        }
        
        return {
          quadclass: item.quadclass || item.quadClass,
          goldsteinscore: item.goldsteinscore || item.goldsteinScale,
          source: item.source || '',
          fullname: item.fullname || item.fullName || '',
          countryCode: item.countryCode || '',
          coordinates: coordinates || [0, 0],
          actorCountryCode: item.actorCountryCode || null,
          actorFilter: item.actorFilter || item.type3Code || null
        };
      });
    }
    
    return result;
  } catch (error) {
    console.error("Error processing natural language query:", error);
    throw error;
  }
};