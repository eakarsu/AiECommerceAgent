#!/bin/bash

# AI E-commerce Agent - Startup Script
# This script sets up and starts the complete application

set -e

echo "=================================================="
echo "   AI E-commerce Agent - Startup Script"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    print_success "Environment variables loaded"
else
    print_error ".env file not found!"
    exit 1
fi

# Set default ports if not specified
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-5173}

# ===========================================
# STEP 1: Clean up used ports
# ===========================================
print_status "Step 1: Cleaning up used ports..."

cleanup_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        print_warning "Port $port is in use by PID $pid. Killing process..."
        kill -9 $pid 2>/dev/null || true
        sleep 1
        print_success "Port $port freed"
    else
        print_success "Port $port is available"
    fi
}

cleanup_port $BACKEND_PORT
cleanup_port $FRONTEND_PORT

echo ""

# ===========================================
# STEP 2: Check PostgreSQL
# ===========================================
print_status "Step 2: Checking PostgreSQL..."

# Check if PostgreSQL is running
if command -v pg_isready &> /dev/null; then
    if pg_isready -q; then
        print_success "PostgreSQL is running"
    else
        print_warning "PostgreSQL is not running. Attempting to start..."
        if command -v brew &> /dev/null; then
            brew services start postgresql@14 || brew services start postgresql
        else
            print_error "Please start PostgreSQL manually"
            exit 1
        fi
        sleep 2
    fi
else
    print_warning "pg_isready not found, assuming PostgreSQL is running"
fi

# Create database if it doesn't exist
print_status "Creating database if not exists..."
createdb ${DB_NAME:-ai_ecommerce_agent} 2>/dev/null || print_warning "Database may already exist"
print_success "Database ready"

echo ""

# ===========================================
# STEP 3: Install dependencies
# ===========================================
print_status "Step 3: Installing dependencies..."

# Install backend dependencies
print_status "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm install --silent
print_success "Backend dependencies installed"

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install --silent
print_success "Frontend dependencies installed"

cd "$SCRIPT_DIR"
echo ""

# ===========================================
# STEP 4: Seed the database
# ===========================================
print_status "Step 4: Seeding database with sample data..."
print_status "This will create 15+ items for each feature..."

cd "$SCRIPT_DIR/backend"
npm run seed

cd "$SCRIPT_DIR"
echo ""

# ===========================================
# STEP 5: Start the application
# ===========================================
print_status "Step 5: Starting the application..."

# Function to handle cleanup on exit
cleanup() {
    print_status "Shutting down..."
    cleanup_port $BACKEND_PORT
    cleanup_port $FRONTEND_PORT
    print_success "Cleanup complete"
    exit 0
}

trap cleanup INT TERM

# Start backend (with --watch for auto-restart on file changes)
print_status "Starting backend on port $BACKEND_PORT (with auto-reload)..."
cd "$SCRIPT_DIR/backend"
npm run dev &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3

# Check if backend started successfully
if kill -0 $BACKEND_PID 2>/dev/null; then
    print_success "Backend started (PID: $BACKEND_PID)"
else
    print_error "Backend failed to start"
    exit 1
fi

# Start frontend
print_status "Starting frontend on port $FRONTEND_PORT..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

sleep 3

# Check if frontend started successfully
if kill -0 $FRONTEND_PID 2>/dev/null; then
    print_success "Frontend started (PID: $FRONTEND_PID)"
else
    print_error "Frontend failed to start"
    exit 1
fi

echo ""
echo "=================================================="
echo -e "${GREEN}   Application Started Successfully!${NC}"
echo "=================================================="
echo ""
echo -e "  ${BLUE}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
echo -e "  ${BLUE}Backend:${NC}   http://localhost:$BACKEND_PORT"
echo -e "  ${BLUE}API:${NC}       http://localhost:$BACKEND_PORT/api"
echo ""
echo -e "  ${GREEN}✨ Auto-reload enabled!${NC}"
echo -e "     Backend: Restarts automatically on file changes"
echo -e "     Frontend: Hot module replacement (HMR) enabled"
echo ""
echo -e "  ${YELLOW}Demo Login:${NC}"
echo -e "    Email:    admin@ecommerce.ai"
echo -e "    Password: admin123"
echo ""
echo -e "  ${YELLOW}Features:${NC}"
echo "    - Product Management"
echo "    - Dynamic Pricing (AI)"
echo "    - Ad Campaigns (AI)"
echo "    - Inventory Management"
echo "    - Customer Analytics"
echo "    - Order Management"
echo "    - Review Analysis (AI)"
echo "    - Content Generation (AI)"
echo "    - Market Trends"
echo "    - Competitor Analysis (AI)"
echo "    - A/B Testing"
echo "    - Sales Forecasting (AI)"
echo "    - Customer Segments (AI)"
echo "    - Product Recommendations (AI)"
echo ""
echo -e "  ${RED}Press Ctrl+C to stop the application${NC}"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
