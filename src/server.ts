import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EmployeeClient } from "juno-erp-client";
import { withStudent, withEmployee, trimData, toProxiedImageUrl } from "./juno.js";

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

export function buildServer() {
  const server = new McpServer({ name: "juno-erp", version: "1.1.0" });

  // ==========================================================
  // Student tools (the logged-in student's own data)
  // ==========================================================
  server.tool("get_profile", "Fetch profile information for the logged-in student.", {}, async () =>
    json(await withStudent(c => c.getPersonalInformation())));

  server.tool("get_academic_info", "Fetch academic information for the logged-in student.", {}, async () =>
    json(await withStudent(c => c.getAcademicInfo())));

  server.tool("get_admission_details", "Fetch admission details for the logged-in student.", {}, async () =>
    json(await withStudent(c => c.getAdmissionDetails())));

  server.tool("get_remaining_fees", "Fetch remaining fees for the logged-in student.", {}, async () =>
    json(await withStudent(c => c.getStudentReceivable())));

  server.tool("get_fees_structure", "Fetch fee structure for the logged-in student.", {}, async () =>
    json(await withStudent(c => c.getFeeStructureByStudentId())));

  server.tool("get_attendance_details", "Fetch attendance details for the logged-in student.", {}, async () =>
    json(await withStudent(c => c.getAttendanceDetails())));

  server.tool("get_attendance_graph", "Fetch attendance graph for the logged-in student.", {}, async () =>
    json(await withStudent(c => c.getAttendanceGraph())));

  server.tool("get_exam_details", "Fetch exam details for the logged-in student.", {}, async () =>
    json(await withStudent(c => c.getExamDetails())));

  server.tool("get_student_results", "Fetch results for a specific exam for the logged-in student.",
    { examScheduleId: z.string(), examSemesterId: z.string(), universitySyllabusId: z.number() },
    async (p) => json(await withStudent(c => c.getStudentResults(p))));

  server.tool("get_today_schedule", "Fetch the logged-in student's schedule for a date.", { date: z.string() },
    async ({ date }) => json(await withStudent(c => c.getTodaySchedule(date))));

  server.tool("get_courses_for_term", "Fetch courses for a specific term (semester).", { termId: z.number() },
    async ({ termId }) => json(trimData(await withStudent(c => c.getCourses(termId)))));

  server.tool("search_student", "Search students/faculty from the student account.", { name: z.string().min(1) },
    async ({ name }) => json(await withStudent(c => c.search(name))));

  // ==========================================================
  // Employee tools (staff account: university-wide management)
  // ==========================================================

  // University-wide search. Profile image URLs are rewritten to this server so
  // the AI can render the authenticated images directly.
  server.tool(
    "search_university",
    "Search across all students and staff (employee account). Returns hits with proxied profile-image URLs.",
    { query: z.string().min(1) },
    async ({ query }) => {
      const results = await withEmployee(c => c.search(query));
      const withProxiedImages = results.map(hit => ({ ...hit, imageUrl: toProxiedImageUrl(hit.imageUrl) }));
      return json(withProxiedImages);
    }
  );

  // All per-student management lookups share the same `studentId` shape.
  const studentLookup = (
    name: string,
    description: string,
    fn: (c: EmployeeClient, studentId: number) => Promise<unknown>,
  ) => {
    server.tool(name, description, { studentId: z.number() }, async ({ studentId }) =>
      json(await withEmployee(c => fn(c, studentId))));
  };

  studentLookup("get_student_personal_information", "Employee: fetch a student's personal information by id.",
    (c, id) => c.getStudentPersonalInformation(id));
  studentLookup("get_student_academic_info", "Employee: fetch a student's academic enrollment info by id.",
    (c, id) => c.getStudentAcademicInfo(id));
  studentLookup("get_student_admission_details", "Employee: fetch a student's admission details by id.",
    (c, id) => c.getStudentAdmissionDetails(id));
  studentLookup("get_student_fees_details", "Employee: fetch a student's fee invoice summary by id.",
    (c, id) => c.getStudentFeesDetails(id));
  studentLookup("get_student_fee_structure", "Employee: fetch a student's detailed fee structure by id.",
    async (c, id) => trimData(await c.getStudentFeeStructure(id)));
  studentLookup("get_student_receivable", "Employee: fetch a student's total receivables by id.",
    (c, id) => c.getStudentReceivable(id));
  studentLookup("get_student_attendance_details", "Employee: fetch a student's attendance summary by id.",
    (c, id) => c.getStudentAttendanceDetails(id));
  studentLookup("get_student_attendance_graph", "Employee: fetch a student's attendance graph data by id.",
    (c, id) => c.getStudentAttendanceGraph(id));
  studentLookup("get_student_marks_graph", "Employee: fetch a student's marks graph data by id.",
    (c, id) => c.getStudentMarksGraph(id));
  studentLookup("get_student_clinical_attendance_analysis", "Employee: fetch a student's clinical attendance analysis by id.",
    (c, id) => c.getStudentClinicalAttendanceAnalysis(id));
  studentLookup("get_student_exam_details", "Employee: fetch a student's exam summary by id.",
    (c, id) => c.getStudentExamDetails(id));
  studentLookup("get_student_transfer_details", "Employee: fetch a student's pending transfer requests by id.",
    (c, id) => c.getStudentTransferDetails(id));
  studentLookup("get_student_transfer_history", "Employee: fetch a student's transfer history by id.",
    (c, id) => c.getStudentTransferHistory(id));
  studentLookup("get_student_event_details", "Employee: fetch a student's event participation by id.",
    (c, id) => c.getStudentEventDetails(id));
  studentLookup("get_student_grievances", "Employee: fetch a student's grievances by id.",
    (c, id) => c.getStudentGrievances(id));
  studentLookup("get_student_library_details", "Employee: fetch a student's library membership by id.",
    (c, id) => c.getStudentLibraryDetails(id));
  studentLookup("get_student_placement_details", "Employee: fetch a student's placement details by id.",
    (c, id) => c.getStudentPlacementDetails(id));
  studentLookup("get_student_hostel_details", "Employee: fetch a student's hostel details by id.",
    (c, id) => c.getStudentHostelDetails(id));
  studentLookup("get_student_course_file_details", "Employee: fetch a student's course-file data by id.",
    (c, id) => c.getStudentCourseFileDetails(id));
  studentLookup("get_student_leave_history", "Employee: fetch a student's leave history by id.",
    (c, id) => c.getStudentLeaveHistory(id));

  return server;
}
