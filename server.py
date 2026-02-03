#!/usr/bin/env python3
"""
Simple Flask server for the Grocery List Organizer
Handles CORS and proxies requests to Anthropic API
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return send_file('grocery-list-organizer.html')

@app.route('/api/claude', methods=['POST'])
def proxy_claude():
    """Proxy endpoint for Anthropic API to avoid CORS issues"""
    try:
        data = request.get_json()
        api_key = data.get('api_key')
        image_data = data.get('image_data')

        if not api_key or not image_data:
            return jsonify({'error': 'Missing api_key or image_data'}), 400

        # Make request to Anthropic API
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'Content-Type': 'application/json',
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01'
            },
            json={
                'model': 'claude-sonnet-4-5-20250929',
                'max_tokens': 1024,
                'messages': [{
                    'role': 'user',
                    'content': [
                        {
                            'type': 'image',
                            'source': {
                                'type': 'base64',
                                'media_type': image_data['mediaType'],
                                'data': image_data['base64']
                            }
                        },
                        {
                            'type': 'text',
                            'text': 'This is a handwritten grocery list. Please extract all the grocery items from this image and return them as a JSON array of strings. Each item should be a separate string in the array. Only include the item names, remove any bullets, quantities (like "2x"), or store names. Return ONLY the JSON array, nothing else. Example format: ["milk", "eggs", "bread"]'
                        }
                    ]
                }]
            }
        )

        return jsonify(response.json()), response.status_code

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🛒 Grocery List Organizer Server")
    print("=" * 50)
    print("Server running at: http://localhost:8001")
    print("Open this URL in your browser to use the app")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    app.run(host='0.0.0.0', port=8001, debug=True)
