import requests
import time
import os
import schedule
import shutil
import zipfile
from datetime import datetime

def download_and_process_gdelt_file():
    try:
        # Create log entry
        print(f"[{datetime.now()}] Running GDELT update check...")
        
        # Path to save files
        save_path = "/Users/aahilali/Desktop/my-app/components/ArangoDBInput"
        
        # Ensure the directory exists
        if not os.path.exists(save_path):
            os.makedirs(save_path)
            print(f"Created directory: {save_path}")
        
        # Get the lastupdate.txt file
        last_update_url = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
        response = requests.get(last_update_url)
        
        if response.status_code != 200:
            print(f"Error fetching update file: HTTP {response.status_code}")
            return
        
        # Extract the first line and parse the ZIP file URL
        first_line = response.text.strip().split('\n')[0]
        parts = first_line.split()
        
        if len(parts) < 3:
            print(f"Unexpected format in lastupdate.txt: {first_line}")
            return
            
        zip_url = parts[2]
        zip_filename = os.path.basename(zip_url)
        
        # Check if we already have this file (unzipped version)
        csv_filename = zip_filename.replace('.zip', '')
        csv_path = os.path.join(save_path, csv_filename)
        if os.path.exists(csv_path):
            print(f"File {csv_filename} already exists, skipping download.")
            return
            
        # Download the ZIP file to a temporary location
        temp_zip_path = os.path.join(save_path, "temp_" + zip_filename)
        print(f"Downloading {zip_url}...")
        
        zip_response = requests.get(zip_url, stream=True)
        if zip_response.status_code != 200:
            print(f"Error downloading ZIP: HTTP {zip_response.status_code}")
            return
            
        # Save the ZIP file to temp location
        with open(temp_zip_path, 'wb') as f:
            shutil.copyfileobj(zip_response.raw, f)
            
        print(f"Successfully downloaded {zip_filename}")
        
        # Unzip the file
        print(f"Unzipping {zip_filename}...")
        with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
            zip_ref.extractall(save_path)
        
        # Remove the temporary zip file
        os.remove(temp_zip_path)
        
        print(f"Successfully unzipped and saved to {save_path}")
        
        # List extracted files
        extracted_files = [f for f in os.listdir(save_path) if os.path.isfile(os.path.join(save_path, f)) and not f.startswith('temp_')]
        print(f"Files in directory: {extracted_files}")
        
    except Exception as e:
        print(f"Error in GDELT update process: {str(e)}")

# Schedule the job to run every 15 minutes
schedule.every(15).minutes.do(download_and_process_gdelt_file)

# Run once at startup
download_and_process_gdelt_file()

# Keep the script running
print("GDELT automatic downloader started. Press Ctrl+C to stop.")
while True:
    schedule.run_pending()
    time.sleep(1)