import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeWithRetry, trimData } from "./juno.js";

export function buildServer() {
  const server = new McpServer({ name: "juno-erp", version: "1.0.0" });

  // Profile tools
  server.tool("get_profile", "Fetch profile information for the logged-in student.", {}, async () => {
    const profile = await executeWithRetry(client => client.getPersonalInformation());
    return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
  });

  server.tool("get_academic_info", "Fetch academic information.", {}, async () => {
    const academicInfo = await executeWithRetry(client => client.getAcademicInfo());
    return { content: [{ type: "text", text: JSON.stringify(academicInfo, null, 2) }] };
  });

  // Admission & Fees
  server.tool("get_admission_details", "Fetch admission details.", {}, async () => {
    const admissionDetails = await executeWithRetry(client => client.getAdmissionDetails());
    return { content: [{ type: "text", text: JSON.stringify(admissionDetails, null, 2) }] };
  });

  server.tool("get_remaining_fees", "Fetch remaining fees details.", {}, async () => {
    const feesDetails = await executeWithRetry(client => client.getStudentReceivable());
    return { content: [{ type: "text", text: JSON.stringify(feesDetails, null, 2) }] };
  });

  server.tool("get_fees_structure", "Fetch fee structure details.", {}, async () => {
    const feeStructure = await executeWithRetry(client => client.getFeeStructureByStudentId());
    return { content: [{ type: "text", text: JSON.stringify(feeStructure, null, 2) }] };
  });

  // Attendance
  server.tool("get_attendance_details", "Fetch attendance details.", {}, async () => {
    const details = await executeWithRetry(client => client.getAttendanceDetails());
    return { content: [{ type: "text", text: JSON.stringify(details, null, 2) }] };
  });

  server.tool("get_attendance_graph", "Fetch attendance graph.", {}, async () => {
    const graph = await executeWithRetry(client => client.getAttendanceGraph());
    return { content: [{ type: "text", text: JSON.stringify(graph, null, 2) }] };
  });

  // Academic & Exams
  server.tool("get_exam_details", "Fetch exam details.", {}, async () => {
    const examDetails = await executeWithRetry(client => client.getExamDetails());
    return { content: [{ type: "text", text: JSON.stringify(examDetails, null, 2) }] };
  });

  server.tool("get_student_results", "Fetch student results.", 
    { examScheduleId: z.string(), examSemesterId: z.string(), universitySyllabusId: z.number() }, 
    async ({ examScheduleId, examSemesterId, universitySyllabusId }) => {
      const results = await executeWithRetry(client => client.getStudentResults({ examScheduleId, examSemesterId, universitySyllabusId }));
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool("get_today_schedule", "Fetch today's schedule.", { date: z.string() }, async ({ date }) => {
    const schedule = await executeWithRetry(client => client.getTodaySchedule(date));
    return { content: [{ type: "text", text: JSON.stringify(schedule, null, 2) }] };
  });

  server.tool("get_courses_for_term", "Fetch courses for a specific term (semester).", { termId: z.number() }, async ({ termId }) => {
    const courses = await executeWithRetry(client => client.getCourses(termId));
    const trimmedCourses = trimData(courses);
    return { content: [{ type: "text", text: JSON.stringify(trimmedCourses, null, 2) }] };
  });

  // Search
  server.tool("search_student", "Search student by name.", { name: z.string().min(1) }, async ({ name }) => {
    const results = await executeWithRetry(client => client.search(name));
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  });

  return server;
}
