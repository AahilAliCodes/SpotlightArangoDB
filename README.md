## Getting Started

### Install Dependencies
Run the following command to install project dependencies:
```bash
npm install
```

### Start the Frontend
Run the Next.js development server:
```bash
npm run dev
```

This will start the frontend at [http://localhost:3000](http://localhost:3000).

### Run the Backend
Navigate to the backend script directory:
```bash
cd components/ArangoDB/
```
Run the backend script:
```bash
python runQuery.py
```

### (Optional) Enable Realtime Updates to the Map
To enable real-time updates, run the following scripts in a split terminal:
```bash
python components/ArangoDB/Clean_CSV.py
python components/ArangoDB/WebScraper.py
```

### Environment Variables
Create a `.env` file in the root directory and add the following keys:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

ARANGO_HOST=
ARANGO_DB_NAME=
ARANGO_USERNAME=
ARANGO_PASSWORD=

WEBHOOK_URL=

NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=
OPENAI_API_KEY=
```
Fill in the values with the appropriate credentials and API keys before running the project.


