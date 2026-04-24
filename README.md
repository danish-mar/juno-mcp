# Juno ERP MCP Client

A modular Model Context Protocol (MCP) server for interacting with MGMU Juno ERP. This client exposes various student-related data as tools for use with LLMs (like Claude).

## 🚀 Features

- **Profile Management**: Fetch student personal information and academic info.
- **Attendance**: Get detailed attendance records and visual graph data.
- **Fees & Admission**: Check remaining fees, fee structure, and admission details.
- **Academics**: Fetch today's schedule, exam results, and course lists for specific terms.
- **Search**: Search for students within the ERP.

## 🛠️ Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```env
   email=your_email@example.com
   password=your_password
   PORT=8987
   ```

3. **Build the Project**:
   ```bash
   npm run build
   ```

## 🏃 Running the Server

### Development Mode
Runs the server using `tsx` for live development:
```bash
npm run dev
```

### Production Mode
Builds and runs the compiled JavaScript:
```bash
npm run build
npm start
```

The server will be available at `http://localhost:8987/mcp`.

## 🐳 Docker Support

The Docker image is automatically built and published to GHCR:
`ghcr.io/danish-mar/juno-mcp:master`

You can run the server using Docker and Docker Compose:

1. **Build and Start**:
   ```bash
   docker-compose up -d --build
   ```

2. **Check Logs**:
   ```bash
   docker logs -f juno-mcp
   ```

3. **Stop**:
   ```bash
   docker-compose down
   ```

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `get_profile` | Fetch profile information for the logged-in student. |
| `get_academic_info` | Fetch academic information. |
| `get_attendance_details` | Fetch detailed attendance records. |
| `get_attendance_graph` | Fetch attendance graph data. |
| `get_today_schedule` | Fetch today's schedule for a specific date. |
| `get_student_results` | Fetch exam results (requires IDs). |
| `get_remaining_fees` | Fetch pending fee details. |
| `search_student` | Search for students by name. |

## 🔒 Security

- Credentials are never hardcoded and are loaded from `.env`.
- `.env` is included in `.gitignore` to prevent accidental exposure.
- Session tokens are managed in-memory and refreshed automatically upon expiry.

## 📄 License

ISC
