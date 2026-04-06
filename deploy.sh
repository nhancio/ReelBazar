#!/bin/bash
set -e

echo "Starting Deployment Process..."

echo "1. Installing dependencies..."
npm install

echo "2. Building application..."
npm run build

echo "3. Pushing changes to repository..."
./gitpush.sh

echo "Deployment and Push successful!"
