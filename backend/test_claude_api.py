#!/usr/bin/env python3
"""
Test Claude API connectivity
"""
import os
import sys
from dotenv import load_dotenv

# Load .env file
load_dotenv()

api_key = os.getenv('ANTHROPIC_API_KEY')

if not api_key or api_key == 'your-api-key-here':
    print("❌ ANTHROPIC_API_KEY not found in .env file")
    sys.exit(1)

print(f"✓ API Key found: {api_key[:25]}...")

# Test import
try:
    import anthropic
    print("✓ anthropic module imported")
except ImportError as e:
    print(f"❌ Failed to import anthropic: {e}")
    sys.exit(1)

# Test API connection
print("\nTesting API connection...")
try:
    client = anthropic.Anthropic(api_key=api_key)
    print("✓ Client initialized")

    message = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=10,
        messages=[{"role": "user", "content": "Hi"}]
    )

    print(f"✓ API call successful!")
    print(f"✓ Response: {message.content[0].text}")
    print("\n✅ All tests passed! Claude API is working.")

except anthropic.APIConnectionError as e:
    print(f"❌ Connection Error: {e}")
    print("\nPossible causes:")
    print("1. No internet connection")
    print("2. Firewall blocking api.anthropic.com")
    print("3. Network requires proxy settings")
    print("\nTry running: curl https://api.anthropic.com/v1/messages")
    sys.exit(1)

except anthropic.AuthenticationError as e:
    print(f"❌ Authentication Error: {e}")
    print("\nYour API key is invalid or expired.")
    print("Get a new key at: https://console.anthropic.com/settings/keys")
    sys.exit(1)

except anthropic.APIError as e:
    print(f"❌ API Error: {e}")
    sys.exit(1)

except Exception as e:
    print(f"❌ Unexpected error: {type(e).__name__}: {e}")
    sys.exit(1)
