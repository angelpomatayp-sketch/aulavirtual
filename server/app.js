import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { all, create, one, remove, storeMode, update, upsert } from './store.js';
import { allowRoles, clearSessionCookie, requireAuth, setSessionCookie, signSession } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const safeUser = ({ passwordHash, ...user }) => user;
const fullName = (user) => `${user?.names || ''} ${user?.lastNames || ''}`.trim();

async function nextCourseCode() {
  const courses = await all('courses');
  const highest = courses.reduce((maximum, course) => {
    const match = /^IS(\d{3,})$/i.exec(course.code || '');
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 300);
  return `IS${String(highest + 1).padStart(3, '0')}`;
}

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.issues[0]?.message || 'Datos inválidos.' });
    req.validated = result.data;
    next();
  };
}

async function enrichSections(sections) {
  const [courses, users, periods, enrollments] = await Promise.all([all('courses'), all('users'), all('periods'), all('enrollments')]);
  return sections.map((section) => ({
    ...section,
    course: courses.find((item) => item._id === section.courseId),
    teacher: safeUser(users.find((item) => item._id === section.teacherId) || {}),
    period: periods.find((item) => item._id === section.periodId),
    enrolled: enrollments.filter((item) => item.sectionId === section._id && item.status === 'active').length
  }));
}

async function assertSectionAccess(req, res, sectionId) {
  const section = await one('sections', { _id: sectionId });
  if (!section) {
    res.status(404).json({ message: 'Sección no encontrada.' });
    return null;
  }
  if (req.auth.role === 'teacher' && section.teacherId !== req.auth.sub) {
    res.status(403).json({ message: 'Esta sección no está asignada al docente.' });
    return null;
  }
  return section;
}

app.get('/api/health', async (_req, res) => res.json({ status: 'ok', dataMode: storeMode(), timestamp: new Date().toISOString() }));

app.post('/api/auth/login', loginLimiter, validate(z.object({ email: z.string().email(), password: z.string().min(6) })), async (req, res) => {
  const user = await one('users', { email: req.validated.email.toLowerCase() });
  if (!user || user.status !== 'active' || !(await bcrypt.compare(req.validated.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
  }
  const token = signSession(user);
  setSessionCookie(res, token);
  res.json({ user: safeUser(user), token });
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await one('users', { _id: req.auth.sub });
  if (!user) return res.status(401).json({ message: 'Usuario no encontrado.' });
  res.json({ user: safeUser(user) });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const [users, courses, rawSections, enrollments, sessions, attendance, evaluations, grades] = await Promise.all([
    all('users'), all('courses'), all('sections'), all('enrollments'), all('sessions'), all('attendance'), all('evaluations'), all('grades')
  ]);
  const sections = await enrichSections(rawSections);
  if (req.auth.role === 'admin') {
    return res.json({
      stats: [
        { label: 'Estudiantes activos', value: users.filter((u) => u.role === 'student' && u.status === 'active').length, tone: 'teal' },
        { label: 'Docentes', value: users.filter((u) => u.role === 'teacher' && u.status === 'active').length, tone: 'blue' },
        { label: 'Cursos', value: courses.length, tone: 'amber' },
        { label: 'Matrículas', value: enrollments.filter((e) => e.status === 'active').length, tone: 'violet' }
      ],
      sections,
      activity: [
        { title: 'Periodo académico activo', detail: '2026-I · matrícula habilitada', time: 'Hoy' },
        { title: 'Notas registradas', detail: `${grades.length} calificaciones disponibles`, time: 'Actualizado' },
        { title: 'Sesiones realizadas', detail: `${sessions.length} sesiones registradas`, time: 'Actualizado' }
      ]
    });
  }
  if (req.auth.role === 'teacher') {
    const mine = sections.filter((s) => s.teacherId === req.auth.sub);
    const mineIds = mine.map((s) => s._id);
    return res.json({
      stats: [
        { label: 'Mis secciones', value: mine.length, tone: 'teal' },
        { label: 'Estudiantes', value: new Set(enrollments.filter((e) => e.status === 'active' && mineIds.includes(e.sectionId)).map((e) => e.studentId)).size, tone: 'blue' },
        { label: 'Sesiones', value: sessions.filter((s) => mineIds.includes(s.sectionId)).length, tone: 'amber' },
        { label: 'Evaluaciones', value: evaluations.filter((e) => mineIds.includes(e.sectionId)).length, tone: 'violet' }
      ],
      sections: mine,
      activity: sessions.filter((s) => mineIds.includes(s.sectionId)).slice(-4).reverse().map((s) => ({ title: s.topic, detail: s.date, time: 'Sesión' }))
    });
  }
  const myEnrollments = enrollments.filter((e) => e.studentId === req.auth.sub && e.status === 'active');
  const mySectionIds = myEnrollments.map((e) => e.sectionId);
  const mySessions = sessions.filter((s) => mySectionIds.includes(s.sectionId));
  const myAttendance = attendance.filter((a) => a.studentId === req.auth.sub);
  const present = myAttendance.filter((a) => ['present', 'late'].includes(a.status)).length;
  const myEvaluations = evaluations.filter((e) => mySectionIds.includes(e.sectionId));
  const myGrades = grades.filter((g) => g.studentId === req.auth.sub);
  const average = myGrades.length ? (myGrades.reduce((sum, grade) => sum + grade.score, 0) / myGrades.length).toFixed(1) : '—';
  return res.json({
    stats: [
      { label: 'Cursos matriculados', value: myEnrollments.length, tone: 'teal' },
      { label: 'Asistencia', value: myAttendance.length ? `${Math.round((present / myAttendance.length) * 100)}%` : '—', tone: 'blue' },
      { label: 'Promedio actual', value: average, tone: 'amber' },
      { label: 'Evaluaciones', value: myEvaluations.length, tone: 'violet' }
    ],
    sections: sections.filter((s) => mySectionIds.includes(s._id)),
    activity: mySessions.slice(-4).reverse().map((s) => ({ title: s.topic, detail: s.date, time: 'Clase' }))
  });
});

app.get('/api/users', requireAuth, allowRoles('admin'), async (req, res) => {
  const users = await all('users', req.query.role ? { role: req.query.role } : {});
  res.json(users.map(safeUser));
});

app.post('/api/users', requireAuth, allowRoles('admin'), validate(z.object({
  names: z.string().min(2), lastNames: z.string().min(2), email: z.string().email(), role: z.enum(['admin', 'teacher', 'student']), code: z.string().min(2)
})), async (req, res) => {
  if (await one('users', { email: req.validated.email.toLowerCase() })) return res.status(409).json({ message: 'El correo ya está registrado.' });
  const user = await create('users', { ...req.validated, email: req.validated.email.toLowerCase(), status: 'active', passwordHash: await bcrypt.hash('Demo2026!', 10) });
  await create('audit', { actorId: req.auth.sub, action: 'CREATE_USER', targetId: user._id, at: new Date().toISOString() });
  res.status(201).json(safeUser(user));
});

app.patch('/api/users/:id', requireAuth, allowRoles('admin'), async (req, res) => {
  const allowed = ['names', 'lastNames', 'code', 'status', 'specialty'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const user = await update('users', req.params.id, changes);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
  res.json(safeUser(user));
});

app.get('/api/catalog', requireAuth, async (req, res) => {
  const [courses, periods, users, sections] = await Promise.all([all('courses'), all('periods'), all('users'), all('sections')]);
  let visibleSections = sections;
  if (req.auth.role === 'teacher') visibleSections = sections.filter((section) => section.teacherId === req.auth.sub);
  if (req.auth.role === 'student') {
    const enrollments = await all('enrollments', { studentId: req.auth.sub });
    visibleSections = sections.filter((section) => enrollments.some((item) => item.status === 'active' && item.sectionId === section._id));
  }
  res.json({ courses, periods, teachers: users.filter((u) => u.role === 'teacher').map(safeUser), sections: await enrichSections(visibleSections) });
});

app.post('/api/courses', requireAuth, allowRoles('admin'), validate(z.object({ name: z.string().min(3), credits: z.coerce.number().min(1).max(10), hours: z.coerce.number().min(1).max(20) })), async (req, res) => {
  const code = await nextCourseCode();
  res.status(201).json(await create('courses', { ...req.validated, code, status: 'active' }));
});

app.patch('/api/courses/:id', requireAuth, allowRoles('admin'), async (req, res) => {
  const allowed = ['name', 'credits', 'hours', 'status'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const course = await update('courses', req.params.id, changes);
  if (!course) return res.status(404).json({ message: 'Curso no encontrado.' });
  res.json(course);
});

app.delete('/api/courses/:id', requireAuth, allowRoles('admin'), async (req, res) => {
  if ((await all('sections', { courseId: req.params.id })).length) return res.status(409).json({ message: 'No se puede eliminar un curso que tiene secciones.' });
  const deleted = await remove('courses', req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Curso no encontrado.' });
  res.status(204).end();
});

app.post('/api/sections', requireAuth, allowRoles('admin'), validate(z.object({ courseId: z.string(), periodId: z.string(), teacherId: z.string(), code: z.string(), schedule: z.string(), capacity: z.coerce.number().min(1).max(100) })), async (req, res) => {
  res.status(201).json(await create('sections', req.validated));
});

app.patch('/api/sections/:id', requireAuth, allowRoles('admin'), async (req, res) => {
  const allowed = ['teacherId', 'code', 'schedule', 'capacity'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const section = await update('sections', req.params.id, changes);
  if (!section) return res.status(404).json({ message: 'Sección no encontrada.' });
  res.json(section);
});

app.delete('/api/sections/:id', requireAuth, allowRoles('admin'), async (req, res) => {
  if ((await all('enrollments', { sectionId: req.params.id })).length) return res.status(409).json({ message: 'No se puede eliminar una sección con estudiantes matriculados.' });
  const deleted = await remove('sections', req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Sección no encontrada.' });
  res.status(204).end();
});

app.get('/api/enrollments', requireAuth, allowRoles('admin'), async (_req, res) => {
  const [enrollments, users, sections] = await Promise.all([all('enrollments'), all('users'), enrichSections(await all('sections'))]);
  res.json(enrollments.map((item) => ({ ...item, student: safeUser(users.find((u) => u._id === item.studentId) || {}), section: sections.find((s) => s._id === item.sectionId) })));
});

app.post('/api/enrollments', requireAuth, allowRoles('admin'), validate(z.object({ studentId: z.string(), sectionId: z.string() })), async (req, res) => {
  const existing = await one('enrollments', req.validated);
  if (existing) return res.status(409).json({ message: existing.status === 'active' ? 'El estudiante ya está matriculado en esta sección.' : 'La matrícula fue retirada. Reactívala desde el historial.' });
  const section = await one('sections', { _id: req.validated.sectionId });
  if (!section) return res.status(404).json({ message: 'Sección no encontrada.' });
  const current = (await all('enrollments', { sectionId: section._id })).filter((item) => item.status === 'active');
  if (current.length >= section.capacity) return res.status(409).json({ message: 'La sección alcanzó su capacidad.' });
  res.status(201).json(await create('enrollments', { ...req.validated, periodId: section.periodId, status: 'active', enrolledAt: new Date().toISOString().slice(0, 10) }));
});

app.delete('/api/enrollments/:id', requireAuth, allowRoles('admin'), async (req, res) => {
  const enrollment = await one('enrollments', { _id: req.params.id });
  if (!enrollment) return res.status(404).json({ message: 'Matrícula no encontrada.' });
  if (enrollment.status !== 'active') return res.status(409).json({ message: 'La matrícula ya está retirada.' });
  res.json(await update('enrollments', enrollment._id, { status: 'withdrawn', withdrawnAt: new Date().toISOString().slice(0, 10) }));
});

app.patch('/api/enrollments/:id/reactivate', requireAuth, allowRoles('admin'), async (req, res) => {
  const enrollment = await one('enrollments', { _id: req.params.id });
  if (!enrollment) return res.status(404).json({ message: 'Matrícula no encontrada.' });
  if (enrollment.status === 'active') return res.status(409).json({ message: 'La matrícula ya está activa.' });
  const section = await one('sections', { _id: enrollment.sectionId });
  if (!section) return res.status(404).json({ message: 'Sección no encontrada.' });
  const active = (await all('enrollments', { sectionId: section._id })).filter((item) => item.status === 'active');
  if (active.length >= section.capacity) return res.status(409).json({ message: 'La sección alcanzó su capacidad.' });
  res.json(await update('enrollments', enrollment._id, { status: 'active', withdrawnAt: null, reactivatedAt: new Date().toISOString().slice(0, 10) }));
});

app.get('/api/sections/:id/workspace', requireAuth, async (req, res) => {
  const section = await assertSectionAccess(req, res, req.params.id);
  if (!section) return;
  if (req.auth.role === 'student') {
    const enrollment = await one('enrollments', { sectionId: section._id, studentId: req.auth.sub });
    if (!enrollment || enrollment.status !== 'active') return res.status(403).json({ message: 'No estás matriculado en esta sección.' });
  }
  const [users, enrollments, sessions, attendance, evaluations, grades] = await Promise.all([
    all('users'), all('enrollments', { sectionId: section._id }), all('sessions', { sectionId: section._id }), all('attendance'), all('evaluations', { sectionId: section._id }), all('grades')
  ]);
  const studentIds = enrollments.filter((e) => e.status === 'active').map((e) => e.studentId);
  res.json({
    section: (await enrichSections([section]))[0],
    students: users.filter((u) => studentIds.includes(u._id)).map(safeUser),
    sessions,
    attendance: attendance.filter((a) => sessions.some((s) => s._id === a.sessionId)),
    evaluations,
    grades: grades.filter((g) => evaluations.some((e) => e._id === g.evaluationId))
  });
});

app.get('/api/sections/:id/grade-summary', requireAuth, allowRoles('admin', 'teacher'), async (req, res) => {
  const section = await assertSectionAccess(req, res, req.params.id);
  if (!section) return;
  const [users, enrollments, evaluations, grades, sessions, attendance] = await Promise.all([
    all('users'), all('enrollments', { sectionId: section._id }), all('evaluations', { sectionId: section._id }), all('grades'), all('sessions', { sectionId: section._id }), all('attendance')
  ]);
  const orderedEvaluations = [...evaluations].sort((a, b) => a.date.localeCompare(b.date));
  const rows = enrollments.filter((enrollment) => enrollment.status === 'active').map((enrollment) => {
    const student = users.find((user) => user._id === enrollment.studentId);
    const completed = orderedEvaluations
      .map((evaluation) => ({ evaluation, grade: grades.find((grade) => grade.evaluationId === evaluation._id && grade.studentId === enrollment.studentId) }))
      .filter((item) => item.grade);
    const completedWeight = completed.reduce((sum, item) => sum + Number(item.evaluation.weight), 0);
    const weightedPoints = completed.reduce((sum, item) => sum + Number(item.grade.score) * Number(item.evaluation.weight), 0);
    const currentAverage = completedWeight ? weightedPoints / completedWeight : null;
    const remainingWeight = Math.max(0, 100 - completedWeight);
    const requiredScore = remainingWeight ? Math.max(0, (1100 - weightedPoints) / remainingWeight) : null;
    const records = attendance.filter((record) => record.studentId === enrollment.studentId && sessions.some((session) => session._id === record.sessionId));
    const attended = records.filter((record) => ['present', 'late', 'justified'].includes(record.status)).length;
    let status = 'Sin notas';
    if (currentAverage !== null) status = currentAverage >= 14 ? 'Buen avance' : currentAverage >= 11 ? 'En progreso' : 'En riesgo';
    if (requiredScore !== null && requiredScore > 20) status = 'Riesgo crítico';
    return {
      student: safeUser(student || {}),
      scores: Object.fromEntries(orderedEvaluations.map((evaluation) => [evaluation._id, grades.find((grade) => grade.evaluationId === evaluation._id && grade.studentId === enrollment.studentId)?.score ?? null])),
      completedWeight,
      currentAverage: currentAverage === null ? null : Number(currentAverage.toFixed(1)),
      accumulated: Number((weightedPoints / 100).toFixed(1)),
      requiredScore: requiredScore === null ? null : Number(requiredScore.toFixed(1)),
      canPass: requiredScore === null || requiredScore <= 20,
      attendance: records.length ? Math.round(attended / records.length * 100) : null,
      status
    };
  });
  const averages = rows.filter((row) => row.currentAverage !== null).map((row) => row.currentAverage);
  const evaluatedWeight = orderedEvaluations.filter((evaluation) => grades.some((grade) => grade.evaluationId === evaluation._id)).reduce((sum, evaluation) => sum + Number(evaluation.weight), 0);
  res.json({
    section: (await enrichSections([section]))[0],
    evaluations: orderedEvaluations,
    rows,
    stats: {
      sectionAverage: averages.length ? Number((averages.reduce((sum, value) => sum + value, 0) / averages.length).toFixed(1)) : null,
      evaluatedWeight,
      passing: rows.filter((row) => row.currentAverage !== null && row.currentAverage >= 11).length,
      atRisk: rows.filter((row) => row.currentAverage !== null && row.currentAverage < 11).length
    }
  });
});

app.post('/api/sessions', requireAuth, allowRoles('admin', 'teacher'), validate(z.object({ sectionId: z.string(), date: z.string(), topic: z.string().min(3) })), async (req, res) => {
  if (!(await assertSectionAccess(req, res, req.validated.sectionId))) return;
  res.status(201).json(await create('sessions', { ...req.validated, status: 'completed' }));
});

app.patch('/api/sessions/:id', requireAuth, allowRoles('admin', 'teacher'), async (req, res) => {
  const session = await one('sessions', { _id: req.params.id });
  if (!session || !(await assertSectionAccess(req, res, session.sectionId))) return;
  res.json(await update('sessions', session._id, { date: req.body.date, topic: req.body.topic }));
});

app.delete('/api/sessions/:id', requireAuth, allowRoles('admin', 'teacher'), async (req, res) => {
  const session = await one('sessions', { _id: req.params.id });
  if (!session || !(await assertSectionAccess(req, res, session.sectionId))) return;
  const records = await all('attendance', { sessionId: session._id });
  await Promise.all(records.map((record) => remove('attendance', record._id)));
  await remove('sessions', session._id);
  res.status(204).end();
});

app.put('/api/sessions/:id/attendance', requireAuth, allowRoles('admin', 'teacher'), validate(z.object({ records: z.array(z.object({ studentId: z.string(), status: z.enum(['present', 'late', 'absent', 'justified']) })) })), async (req, res) => {
  const session = await one('sessions', { _id: req.params.id });
  if (!session || !(await assertSectionAccess(req, res, session.sectionId))) return;
  const saved = await Promise.all(req.validated.records.map((record) => upsert('attendance', { sessionId: session._id, studentId: record.studentId }, { status: record.status })));
  res.json(saved);
});

app.post('/api/evaluations', requireAuth, allowRoles('admin', 'teacher'), validate(z.object({ sectionId: z.string(), name: z.string().min(2), type: z.string().min(2), weight: z.coerce.number().min(1).max(100), date: z.string() })), async (req, res) => {
  if (!(await assertSectionAccess(req, res, req.validated.sectionId))) return;
  const existing = await all('evaluations', { sectionId: req.validated.sectionId });
  if (existing.reduce((sum, item) => sum + Number(item.weight), 0) + req.validated.weight > 100) return res.status(409).json({ message: 'Las ponderaciones no pueden superar el 100 %.' });
  res.status(201).json(await create('evaluations', req.validated));
});

app.patch('/api/evaluations/:id', requireAuth, allowRoles('admin', 'teacher'), async (req, res) => {
  const evaluation = await one('evaluations', { _id: req.params.id });
  if (!evaluation || !(await assertSectionAccess(req, res, evaluation.sectionId))) return;
  const allowed = ['name', 'type', 'weight', 'date'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  res.json(await update('evaluations', evaluation._id, changes));
});

app.delete('/api/evaluations/:id', requireAuth, allowRoles('admin', 'teacher'), async (req, res) => {
  const evaluation = await one('evaluations', { _id: req.params.id });
  if (!evaluation || !(await assertSectionAccess(req, res, evaluation.sectionId))) return;
  const records = await all('grades', { evaluationId: evaluation._id });
  await Promise.all(records.map((record) => remove('grades', record._id)));
  await remove('evaluations', evaluation._id);
  res.status(204).end();
});

app.put('/api/evaluations/:id/grades', requireAuth, allowRoles('admin', 'teacher'), validate(z.object({ records: z.array(z.object({ studentId: z.string(), score: z.coerce.number().min(0).max(20) })) })), async (req, res) => {
  const evaluation = await one('evaluations', { _id: req.params.id });
  if (!evaluation || !(await assertSectionAccess(req, res, evaluation.sectionId))) return;
  const saved = await Promise.all(req.validated.records.map((record) => upsert('grades', { evaluationId: evaluation._id, studentId: record.studentId }, { score: record.score })));
  await create('audit', { actorId: req.auth.sub, action: 'UPDATE_GRADES', targetId: evaluation._id, at: new Date().toISOString() });
  res.json(saved);
});

app.get('/api/student/progress', requireAuth, allowRoles('student'), async (req, res) => {
  const studentId = req.auth.sub;
  const [student, enrollments, sections, courses, evaluations, grades, sessions, attendance] = await Promise.all([
    one('users', { _id: studentId }), all('enrollments', { studentId }), all('sections'), all('courses'), all('evaluations'), all('grades', { studentId }), all('sessions'), all('attendance', { studentId })
  ]);
  if (!student) return res.status(404).json({ message: 'Estudiante no encontrado.' });

  const coursesProgress = enrollments.filter((enrollment) => enrollment.status === 'active').map((enrollment) => {
    const section = sections.find((item) => item._id === enrollment.sectionId);
    const course = courses.find((item) => item._id === section?.courseId);
    const sectionEvaluations = evaluations.filter((item) => item.sectionId === section?._id).sort((a, b) => a.date.localeCompare(b.date));
    const evaluationProgress = sectionEvaluations.map((evaluation) => ({
      ...evaluation,
      score: grades.find((grade) => grade.evaluationId === evaluation._id)?.score ?? null
    }));
    const completed = evaluationProgress.filter((evaluation) => evaluation.score !== null);
    const completedWeight = completed.reduce((sum, evaluation) => sum + Number(evaluation.weight), 0);
    const weightedPoints = completed.reduce((sum, evaluation) => sum + Number(evaluation.score) * Number(evaluation.weight), 0);
    const currentAverage = completedWeight ? weightedPoints / completedWeight : null;
    const remainingWeight = Math.max(0, 100 - completedWeight);
    const requiredScore = remainingWeight ? Math.max(0, (1100 - weightedPoints) / remainingWeight) : null;
    const sectionSessions = sessions.filter((item) => item.sectionId === section?._id);
    const records = attendance.filter((record) => sectionSessions.some((session) => session._id === record.sessionId));
    const attended = records.filter((record) => ['present', 'late', 'justified'].includes(record.status)).length;
    let status = 'Sin notas';
    if (currentAverage !== null) status = currentAverage >= 14 ? 'Buen avance' : currentAverage >= 11 ? 'En progreso' : 'En riesgo';
    if (requiredScore !== null && requiredScore > 20) status = 'Riesgo crítico';
    return {
      enrollmentId: enrollment._id,
      course: course || {},
      section: section || {},
      evaluations: evaluationProgress,
      completedWeight,
      remainingWeight,
      currentAverage: currentAverage === null ? null : Number(currentAverage.toFixed(1)),
      accumulated: Number((weightedPoints / 100).toFixed(1)),
      requiredScore: requiredScore === null ? null : Number(requiredScore.toFixed(1)),
      attendance: records.length ? Math.round(attended / records.length * 100) : null,
      status
    };
  });
  const averages = coursesProgress.filter((item) => item.currentAverage !== null).map((item) => item.currentAverage);
  const attendanceValues = coursesProgress.filter((item) => item.attendance !== null).map((item) => item.attendance);
  res.json({
    student: safeUser(student),
    courses: coursesProgress,
    stats: {
      enrolled: coursesProgress.length,
      overallAverage: averages.length ? Number((averages.reduce((sum, value) => sum + value, 0) / averages.length).toFixed(1)) : null,
      averageAttendance: attendanceValues.length ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length) : null,
      atRisk: coursesProgress.filter((item) => ['En riesgo', 'Riesgo crítico'].includes(item.status)).length
    }
  });
});

app.get('/api/reports/academic', requireAuth, async (req, res) => {
  const targetId = req.auth.role === 'student' ? req.auth.sub : req.query.studentId;
  if (!targetId) return res.status(400).json({ message: 'Selecciona un estudiante.' });
  const [student, enrollments, sections, courses, evaluations, grades, sessions, attendance] = await Promise.all([
    one('users', { _id: targetId }), all('enrollments', { studentId: targetId }), all('sections'), all('courses'), all('evaluations'), all('grades', { studentId: targetId }), all('sessions'), all('attendance', { studentId: targetId })
  ]);
  if (!student) return res.status(404).json({ message: 'Estudiante no encontrado.' });
  const rows = enrollments.filter((enrollment) => enrollment.status === 'active').map((enrollment) => {
    const section = sections.find((s) => s._id === enrollment.sectionId);
    const course = courses.find((c) => c._id === section?.courseId);
    const evals = evaluations.filter((e) => e.sectionId === section?._id);
    const completed = evals.map((evaluation) => ({ evaluation, grade: grades.find((g) => g.evaluationId === evaluation._id) })).filter((item) => item.grade);
    const completedWeight = completed.reduce((sum, item) => sum + Number(item.evaluation.weight), 0);
    const weighted = completed.reduce((sum, item) => {
      return sum + item.grade.score * item.evaluation.weight;
    }, 0);
    const sectionSessions = sessions.filter((s) => s.sectionId === section?._id);
    const records = attendance.filter((a) => sectionSessions.some((s) => s._id === a.sessionId));
    const attended = records.filter((a) => ['present', 'late', 'justified'].includes(a.status)).length;
    return { Curso: course?.name || '—', Sección: section?.code || '—', Promedio: completedWeight ? (weighted / completedWeight).toFixed(1) : 'Pendiente', Asistencia: records.length ? `${Math.round(attended / records.length * 100)}%` : 'Sin registro' };
  });
  if (req.query.format === 'xls') {
    const xmlEscape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const headers = ['Curso', 'Sección', 'Promedio', 'Asistencia'];
    const xmlRows = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
      .map((row, index) => `<Row>${row.map((value) => `<Cell${index === 0 ? ' ss:StyleID="Header"' : ''}><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`).join('')}</Row>`).join('');
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F5958" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="Resumen académico"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${student.code}.xls"`);
    return res.type('application/vnd.ms-excel').send(workbook);
  }
  if (req.query.format === 'pdf') {
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${student.code}.pdf"`);
    res.type('application/pdf');
    const pdf = new PDFDocument({ margin: 48, size: 'LETTER' });
    pdf.pipe(res);
    pdf.fontSize(20).fillColor('#123c3d').text('Reporte académico');
    pdf.moveDown(0.5).fontSize(11).fillColor('#333').text(`${fullName(student)} · ${student.code}`);
    pdf.text('Periodo 2026-I');
    pdf.moveDown();
    rows.forEach((row) => {
      pdf.fontSize(12).fillColor('#123c3d').text(`${row.Curso} · Sección ${row.Sección}`);
      pdf.fontSize(10).fillColor('#444').text(`Promedio: ${row.Promedio}    Asistencia: ${row.Asistencia}`);
      pdf.moveDown(0.7);
    });
    pdf.moveDown().fontSize(8).fillColor('#777').text(`Generado el ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`);
    pdf.end();
    return;
  }
  res.json({ student: safeUser(student), rows });
});

const dist = path.resolve(__dirname, '..', 'dist');
app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(dist, 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Ocurrió un error inesperado.' : error.message });
});

export default app;
