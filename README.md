# BlockchainCrypto Demo

**Web-Based Demonstrator for Blockchain Cryptographic Primitives: Hashing, Digital Signatures, and Merkle Trees**

An interactive educational web application that demonstrates core blockchain cryptographic concepts including SHA-256 & Keccak-256 hashing, ECDSA digital signatures on secp256k1, Merkle tree construction and proof verification, and a simplified blockchain simulation.

> ⚠️ **Educational Simulation** — This application is designed for learning and demonstration purposes. It is NOT a production cryptocurrency system. Do not use generated keys for real financial transactions.

## Features

- **Cryptographic Hashing** — Real-time SHA-256 and Keccak-256 comparison with timing metrics
- **ECDSA Digital Signatures** — Key generation, transaction signing, and verification on secp256k1
- **Merkle Trees** — Interactive D3.js animated visualization, proof generation and verification
- **Blockchain Simulation** — Block creation, hash chain linking, integrity verification, and tamper detection
- **Performance Dashboard** — Chart.js visualizations of actual operation metrics from the database
- **User Authentication** — Secure registration/login with bcrypt password hashing and sessions

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | SQLite (sql.js) |
| Cryptography | Web Crypto API, js-sha3, elliptic.js |
| Visualization | D3.js, Chart.js |
| Authentication | bcryptjs, express-session |
| Security | Helmet.js, CORS, parameterized queries |

## Quick Start

### Prerequisites
- Node.js 18+ installed

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Start the server (automatically initializes the database)
npm start
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

1. Create an account using the registration form
2. Log in and explore the cryptographic modules

## Project Structure

```
cryptography/
├── public/                    # Frontend (Presentation Layer)
│   ├── index.html             # Single-page application
│   ├── css/
│   │   └── main.css           # Styles and responsive design
│   └── js/
│       ├── utils.js           # Shared utilities
│       ├── auth.js            # Authentication module
│       ├── HashingModule.js   # SHA-256 & Keccak-256 hashing
│       ├── SigningModule.js   # ECDSA digital signatures
│       ├── MerkleModule.js    # Merkle tree visualization
│       ├── BlockchainModule.js # Blockchain simulation
│       ├── DashboardModule.js # Performance dashboard
│       └── app.js             # App controller & routing
├── server/                    # Backend (Application Layer)
│   ├── app.js                 # Express server entry point
│   ├── database/              # Database Layer
│   │   ├── connection.js      # SQLite connection singleton
│   │   └── init.js            # Schema initialization
│   ├── middleware/
│   │   └── auth.js            # Authentication middleware
│   ├── routes/
│   │   ├── auth.js            # Auth endpoints
│   │   ├── crypto.js          # Crypto operation endpoints
│   │   ├── blockchain.js      # Blockchain endpoints
│   │   └── dashboard.js       # Dashboard data endpoint
│   └── services/
│       ├── authService.js     # User authentication logic
│       ├── cryptoService.js   # Cryptographic operations
│       ├── blockchainService.js # Block/chain management
│       └── dashboardService.js  # Metrics aggregation
├── .env                       # Environment configuration
├── .env.example               # Configuration template
├── .gitignore
├── package.json
└── README.md
```

## Database Schema

### Core Tables (as specified)

1. **`blockchain_blocks`** — Block chain records with hash, previous_hash, merkle_root, timestamp, nonce
2. **`transaction_records`** — Transaction data with FK to blocks, hash, public key, signature (r, s)
3. **`merkle_proofs`** — Proof records with FK to transactions and blocks, proof path, validity flag

### Supporting Tables

4. **`users`** — Authentication (username, email, bcrypt-hashed password)
5. **`hash_operations`** — Hashing performance records
6. **`signing_operations`** — Signing/verification performance records
7. **`merkle_operations`** — Merkle tree operation records

## Security

- Private keys are generated and used **exclusively in the browser** — never transmitted to the server
- Passwords are hashed with bcrypt (configurable rounds)
- All database queries use parameterized statements
- Security headers via Helmet.js
- Session cookies are httpOnly with configurable max age
- Input validation on both client and server
- Request body size limited to 1MB

## License

MIT
