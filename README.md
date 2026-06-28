# Juno ERP MCP Client

A modular Model Context Protocol (MCP) server for interacting with MGMU Juno ERP. It exposes both **student** (own data) and **employee** (university-wide management) capabilities as tools for use with LLMs (like Claude).

## 🚀 Features

- **Student tools**: profile, academic info, attendance (+ graph), fees, admission, exam results, schedule, courses, search.
- **Employee tools**: university-wide search and the full student-management dashboard (personal info, academics, fees, attendance/marks graphs, exams, transfers, hostel, library, placement, grievances, leave, and more) — looked up by `studentId`.
- **Profile-image proxy**: `search_university` rewrites profile-picture URLs to this server, which streams the **authenticated** image back so the AI panel can render it directly.
- **Optional proxy**: route ERP traffic through an HTTP/HTTPS/SOCKS proxy, or auto-pick a free one.

## 🛠️ Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**: copy `.env.example` to `.env` and fill it in.
   ```bash
   cp .env.example .env
   ```
   - **Student account**: `STUDENT_EMAIL` / `STUDENT_PASSWORD` (legacy `email` / `password` still work).
   - **Employee account**: `EMPLOYEE_EMAIL` / `EMPLOYEE_PASSWORD` — required for the employee tools and the image proxy.
   - **`PUBLIC_URL`**: the externally reachable base URL of this server (used to build image links). Defaults to `http://localhost:<PORT>`.
   - **Proxy** (optional): set `PROXY_URL`, or `PROXY_USE_RANDOM=true` to auto-pick a free one. No proxy is used unless configured.

3. **Build**:
   ```bash
   npm run build
   ```

## 🏃 Running the Server

```bash
npm run dev            # live development
# or
npm run build && npm start
```

The MCP endpoint is `http://localhost:8987/mcp`. Health check at `/health`.

## 🖼️ Profile-image proxy

`search_university` returns each hit with its `imageUrl` rewritten to:

```
<PUBLIC_URL>/img/getStudentProfileImageById.json?id=<id>
<PUBLIC_URL>/img/getEmployeeProfileImageById.json?id=<id>
```

Requesting that URL makes the server fetch the image from the ERP using the
logged-in **employee** session and stream it back, so the AI can display it
without its own credentials. Only the two known profile-image endpoints are
proxied (it is not an open proxy).

## 🐳 Docker Support

The image is published to GHCR: `ghcr.io/danish-mar/juno-mcp:master`.

```bash
docker-compose up -d --build
docker logs -f juno-mcp
docker-compose down
```

This depends on `juno-erp-client@^1.1.0` from npm, so the Docker build's
`npm install` resolves it from the registry with no extra setup.

## 🧰 Available Tools

### Student (logged-in student's own data)

`get_profile`, `get_academic_info`, `get_admission_details`, `get_remaining_fees`,
`get_fees_structure`, `get_attendance_details`, `get_attendance_graph`,
`get_exam_details`, `get_student_results`, `get_today_schedule`,
`get_courses_for_term`, `search_student`

### Employee (staff account)

- `search_university` — search all students/staff; profile images are proxied.
- Per-student lookups (take a `studentId`): `get_student_personal_information`,
  `get_student_academic_info`, `get_student_admission_details`,
  `get_student_fees_details`, `get_student_fee_structure`, `get_student_receivable`,
  `get_student_attendance_details`, `get_student_attendance_graph`,
  `get_student_marks_graph`, `get_student_clinical_attendance_analysis`,
  `get_student_exam_details`, `get_student_transfer_details`,
  `get_student_transfer_history`, `get_student_event_details`,
  `get_student_grievances`, `get_student_library_details`,
  `get_student_placement_details`, `get_student_hostel_details`,
  `get_student_course_file_details`, `get_student_leave_history`

## 🔒 Security

- Credentials are loaded from `.env` (gitignored), never hardcoded.
- Sessions are kept in memory per role and refreshed automatically on expiry.
- The image proxy is restricted to the two ERP profile-image endpoints.

## 📄 License

ISC
