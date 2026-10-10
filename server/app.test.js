import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from './app.js';
import { closeStore, initStore } from './store.js';

beforeAll(async () => initStore({ reset: true }));
afterAll(async () => closeStore());

async function login(email = 'admin@continental.edu.pe') {
  const response = await request(app).post('/api/auth/login').send({ email, password: 'Demo2026!' });
  return { token: response.body.token, response };
}

describe('Aula Continental API', () => {
  it('informa que el servicio está disponible', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', dataMode: 'memory' });
  });

  it('autentica una cuenta demo y devuelve su rol', async () => {
    const { response } = await login();
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('admin');
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('rechaza credenciales incorrectas', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'admin@continental.edu.pe', password: 'incorrecta' });
    expect(response.status).toBe(401);
  });

  it('exige el dominio institucional al registrar usuarios', async () => {
    const { token } = await login();
    const response = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({
      names: 'Usuario', lastNames: 'Externo', email: 'usuario@gmail.com', role: 'student', code: '2026999'
    });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('@continental.edu.pe');
  });

  it('protege el directorio de usuarios por rol', async () => {
    const { token } = await login('estudiante@continental.edu.pe');
    const response = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it('limita el catálogo del docente a sus cursos, secciones y perfil', async () => {
    const { token } = await login('docente@continental.edu.pe');
    const response = await request(app).get('/api/catalog').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.sections.every((section) => section.teacherId === 'u-teacher-1')).toBe(true);
    expect(response.body.courses.map((course) => course._id).sort()).toEqual(['c-prog', 'c-req']);
    expect(response.body.teachers.map((teacher) => teacher._id)).toEqual(['u-teacher-1']);
  });

  it('devuelve al estudiante únicamente sus datos dentro del espacio de una sección', async () => {
    const { token } = await login('estudiante@continental.edu.pe');
    const response = await request(app).get('/api/sections/s-prog-a/workspace').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.students.map((student) => student._id)).toEqual(['u-student-1']);
    expect(response.body.grades.every((grade) => grade.studentId === 'u-student-1')).toBe(true);
    expect(response.body.attendance.every((record) => record.studentId === 'u-student-1')).toBe(true);
    expect(response.body.section.enrolled).toBeUndefined();
  });

  it('impide al docente acceder a reportes globales y secciones ajenas', async () => {
    const { token } = await login('docente@continental.edu.pe');
    const report = await request(app).get('/api/reports/academic?studentId=u-student-3').set('Authorization', `Bearer ${token}`);
    const workspace = await request(app).get('/api/sections/s-db-a/workspace').set('Authorization', `Bearer ${token}`);
    expect(report.status).toBe(403);
    expect(workspace.status).toBe(403);
  });

  it('evita matrículas duplicadas', async () => {
    const { token } = await login();
    const response = await request(app).post('/api/enrollments').set('Authorization', `Bearer ${token}`).send({ studentId: 'u-student-1', sectionId: 's-prog-a' });
    expect(response.status).toBe(409);
  });

  it('retira y reactiva una matrícula sin borrar su historial', async () => {
    const { token } = await login();
    const withdrawn = await request(app).delete('/api/enrollments/e-req-2').set('Authorization', `Bearer ${token}`);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body).toMatchObject({ _id: 'e-req-2', status: 'withdrawn' });
    expect(withdrawn.body.withdrawnAt).toBeTruthy();

    const reactivated = await request(app).patch('/api/enrollments/e-req-2/reactivate').set('Authorization', `Bearer ${token}`);
    expect(reactivated.status).toBe(200);
    expect(reactivated.body).toMatchObject({ _id: 'e-req-2', status: 'active', withdrawnAt: null });
  });

  it('genera automáticamente el correlativo de un curso nuevo', async () => {
    const { token } = await login();
    const response = await request(app).post('/api/courses').set('Authorization', `Bearer ${token}`).send({ name: 'Arquitectura de Software', credits: 4, hours: 5 });
    expect(response.status).toBe(201);
    expect(response.body.code).toBe('IS305');
  });

  it('impide registrar notas fuera de la escala de 0 a 20', async () => {
    const { token } = await login('docente@continental.edu.pe');
    const response = await request(app).put('/api/evaluations/ev-1/grades').set('Authorization', `Bearer ${token}`).send({ records: [{ studentId: 'u-student-1', score: 21 }] });
    expect(response.status).toBe(400);
  });

  it('rechaza notas y asistencias de personas sin matrícula activa en la sección', async () => {
    const { token } = await login('docente@continental.edu.pe');
    const grades = await request(app).put('/api/evaluations/ev-1/grades').set('Authorization', `Bearer ${token}`).send({ records: [{ studentId: 'u-teacher-2', score: 15 }] });
    const attendance = await request(app).put('/api/sessions/ses-1/attendance').set('Authorization', `Bearer ${token}`).send({ records: [{ studentId: 'u-teacher-2', status: 'present' }] });
    expect(grades.status).toBe(400);
    expect(attendance.status).toBe(400);
  });

  it('calcula el consolidado de notas para el docente', async () => {
    const { token } = await login('docente@continental.edu.pe');
    const response = await request(app).get('/api/sections/s-prog-a/grade-summary').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.stats.evaluatedWeight).toBe(60);
    expect(response.body.rows[0]).toMatchObject({ currentAverage: 17.4, accumulated: 10.4, status: 'Buen avance' });
  });

  it('genera el resumen académico de un estudiante', async () => {
    const { token } = await login('estudiante@continental.edu.pe');
    const response = await request(app).get('/api/reports/academic').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.rows.length).toBeGreaterThan(0);
  });

  it('ignora un identificador ajeno en el reporte solicitado por un estudiante', async () => {
    const { token } = await login('estudiante@continental.edu.pe');
    const response = await request(app).get('/api/reports/academic?studentId=u-student-2').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.student._id).toBe('u-student-1');
  });

  it('alinea el promedio del resumen con el avance ponderado del estudiante', async () => {
    const { token } = await login('estudiante@continental.edu.pe');
    const response = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    const average = response.body.stats.find((item) => item.label === 'Promedio actual');
    expect(response.status).toBe(200);
    expect(average.value).toBe('17.4');
  });

  it('invalida una sesión existente cuando la cuenta es desactivada', async () => {
    const { token: studentToken } = await login('luciana.rojas@continental.edu.pe');
    const { token: adminToken } = await login();
    await request(app).patch('/api/users/u-student-4').set('Authorization', `Bearer ${adminToken}`).send({ status: 'inactive' });
    const response = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${studentToken}`);
    expect(response.status).toBe(401);
    await request(app).patch('/api/users/u-student-4').set('Authorization', `Bearer ${adminToken}`).send({ status: 'active' });
  });

  it('muestra el avance privado y detallado del estudiante autenticado', async () => {
    const { token } = await login('estudiante@continental.edu.pe');
    const response = await request(app).get('/api/student/progress').set('Authorization', `Bearer ${token}`);
    const programming = response.body.courses.find((item) => item.course.name === 'Programación Web');
    expect(response.status).toBe(200);
    expect(response.body.courses.length).toBeGreaterThan(0);
    expect(programming).toMatchObject({ currentAverage: 17.4, completedWeight: 60, status: 'Buen avance' });
  });

  it('exporta el reporte en PDF y formato Excel', async () => {
    const { token } = await login('estudiante@continental.edu.pe');
    const pdf = await request(app).get('/api/reports/academic?format=pdf').set('Authorization', `Bearer ${token}`);
    const excel = await request(app).get('/api/reports/academic?format=xls').set('Authorization', `Bearer ${token}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(excel.status).toBe(200);
    expect(excel.headers['content-type']).toContain('application/vnd.ms-excel');
  });
});
