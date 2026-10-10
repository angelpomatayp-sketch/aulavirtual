import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from './app.js';
import { closeStore, initStore } from './store.js';

beforeAll(async () => initStore({ reset: true }));
afterAll(async () => closeStore());

async function login(email = 'admin@demo.edu.pe') {
  const response = await request(app).post('/api/auth/login').send({ email, password: 'Demo2026!' });
  return { token: response.body.token, response };
}

describe('Aula Norte API', () => {
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
    const response = await request(app).post('/api/auth/login').send({ email: 'admin@demo.edu.pe', password: 'incorrecta' });
    expect(response.status).toBe(401);
  });

  it('protege el directorio de usuarios por rol', async () => {
    const { token } = await login('estudiante@demo.edu.pe');
    const response = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
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
    const { token } = await login('docente@demo.edu.pe');
    const response = await request(app).put('/api/evaluations/ev-1/grades').set('Authorization', `Bearer ${token}`).send({ records: [{ studentId: 'u-student-1', score: 21 }] });
    expect(response.status).toBe(400);
  });

  it('calcula el consolidado de notas para el docente', async () => {
    const { token } = await login('docente@demo.edu.pe');
    const response = await request(app).get('/api/sections/s-prog-a/grade-summary').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.stats.evaluatedWeight).toBe(60);
    expect(response.body.rows[0]).toMatchObject({ currentAverage: 17.4, accumulated: 10.4, status: 'Buen avance' });
  });

  it('genera el resumen académico de un estudiante', async () => {
    const { token } = await login('estudiante@demo.edu.pe');
    const response = await request(app).get('/api/reports/academic').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.rows.length).toBeGreaterThan(0);
  });

  it('muestra el avance privado y detallado del estudiante autenticado', async () => {
    const { token } = await login('estudiante@demo.edu.pe');
    const response = await request(app).get('/api/student/progress').set('Authorization', `Bearer ${token}`);
    const programming = response.body.courses.find((item) => item.course.name === 'Programación Web');
    expect(response.status).toBe(200);
    expect(response.body.courses.length).toBeGreaterThan(0);
    expect(programming).toMatchObject({ currentAverage: 17.4, completedWeight: 60, status: 'Buen avance' });
  });

  it('exporta el reporte en PDF y formato Excel', async () => {
    const { token } = await login('estudiante@demo.edu.pe');
    const pdf = await request(app).get('/api/reports/academic?format=pdf').set('Authorization', `Bearer ${token}`);
    const excel = await request(app).get('/api/reports/academic?format=xls').set('Authorization', `Bearer ${token}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(excel.status).toBe(200);
    expect(excel.headers['content-type']).toContain('application/vnd.ms-excel');
  });
});
