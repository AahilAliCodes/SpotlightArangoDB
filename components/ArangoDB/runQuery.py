from arango import ArangoClient
from flask import Flask, jsonify
import os
from datetime import datetime
from config import ARANGO_HOST, ARANGO_USERNAME, ARANGO_PASSWORD

# Initialize Flask app
app = Flask(__name__)

@app.route('/api/events', methods=['GET'])
def get_events():
    try:
        # Connect to database using config variables
        client = ArangoClient(hosts=ARANGO_HOST)
        db = client.db(
            username=ARANGO_USERNAME, 
            password=ARANGO_PASSWORD, 
            verify=True
        )
        
        # Query for events
        aql_query = """
            WITH Events, Actors, Locations, EventRelations
    FOR event IN Events
        LET location = (
            FOR v, e IN 1..1 OUTBOUND event EventRelations
            FILTER IS_SAME_COLLECTION("Locations", v)
            RETURN v
        )[0]
        LET actor = (
            FOR v, e IN 1..1 OUTBOUND event EventRelations
            FILTER IS_SAME_COLLECTION("Actors", v)
            RETURN v
        )[0]
        FILTER location != null
        SORT RAND()
        RETURN {
            source: event.source,
            goldsteinscore: TO_NUMBER(event.goldsteinScale),
            quadclass: event.quadClass,
            fullname: location.fullname,
            countryCode: location.countryCode,
            actorCountryCode: actor.countryCode,
            actorFilter: actor.type3Code,
            coordinates: [location.latitude, location.longitude]
        }
        """
        
        # Execute the query
        cursor = db.aql.execute(aql_query)
        interesting_events = list(cursor)
        print(interesting_events)
        
        # Add relative time for display purposes
        now = datetime.now()
        for i, event in enumerate(interesting_events):
            # Set all events to display "15 minutes ago"
            event['time_ago'] = "15 minutes ago"
        
        return jsonify(interesting_events)
    
    except Exception as e:
        # Return a more helpful error message with proper status code
        error_msg = str(e)
        print(f"Error retrieving events: {error_msg}")
        return jsonify({"error": error_msg}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=True)