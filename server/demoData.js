import bcrypt from 'bcryptjs';

export async function createDemoData() {
  const passwordHash = await bcrypt.hash('Demo2026!', 10);
  const users = [
    { _id: 'u-admin', names: 'María Elena', lastNames: 'Torres Salas', email: 'admin@demo.edu.pe', role: 'admin', status: 'active', passwordHash, code: 'ADM001' },
    { _id: 'u-teacher-1', names: 'Carlos', lastNames: 'Mendoza Ruiz', email: 'docente@demo.edu.pe', role: 'teacher', status: 'active', passwordHash, code: 'DOC001', specialty: 'Ingeniería de software' },
    { _id: 'u-teacher-2', names: 'Ana Lucía', lastNames: 'Quispe Vera', email: 'ana.quispe@demo.edu.pe', role: 'teacher', status: 'active', passwordHash, code: 'DOC002', specialty: 'Base de datos' },
    { _id: 'u-student-1', names: 'Diego', lastNames: 'Flores Paredes', email: 'estudiante@demo.edu.pe', role: 'student', status: 'active', passwordHash, code: '2026001' },
    { _id: 'u-student-2', names: 'Valeria', lastNames: 'Condori Ramos', email: 'valeria.condori@demo.edu.pe', role: 'student', status: 'active', passwordHash, code: '2026002' },
    { _id: 'u-student-3', names: 'Mateo', lastNames: 'Chávez Núñez', email: 'mateo.chavez@demo.edu.pe', role: 'student', status: 'active', passwordHash, code: '2026003' },
    { _id: 'u-student-4', names: 'Luciana', lastNames: 'Rojas Soto', email: 'luciana.rojas@demo.edu.pe', role: 'student', status: 'active', passwordHash, code: '2026004' }
  ];

  return {
    users,
    periods: [{ _id: 'p-2026-1', name: '2026-I', startDate: '2026-03-16', endDate: '2026-07-18', status: 'active' }],
    courses: [
      { _id: 'c-prog', code: 'IS301', name: 'Programación Web', credits: 4, hours: 6, status: 'active' },
      { _id: 'c-db', code: 'IS302', name: 'Base de Datos II', credits: 4, hours: 5, status: 'active' },
      { _id: 'c-req', code: 'IS303', name: 'Ingeniería de Requisitos', credits: 3, hours: 4, status: 'active' },
      { _id: 'c-net', code: 'IS304', name: 'Redes y Comunicaciones', credits: 3, hours: 4, status: 'active' }
    ],
    sections: [
      { _id: 's-prog-a', courseId: 'c-prog', periodId: 'p-2026-1', teacherId: 'u-teacher-1', code: 'A', schedule: 'Lun y Mié · 09:00', capacity: 30 },
      { _id: 's-req-a', courseId: 'c-req', periodId: 'p-2026-1', teacherId: 'u-teacher-1', code: 'A', schedule: 'Mar y Jue · 11:00', capacity: 28 },
      { _id: 's-db-a', courseId: 'c-db', periodId: 'p-2026-1', teacherId: 'u-teacher-2', code: 'A', schedule: 'Mar y Jue · 08:00', capacity: 30 }
    ],
    enrollments: [
      ...['u-student-1', 'u-student-2', 'u-student-3', 'u-student-4'].flatMap((studentId, index) => [
        { _id: `e-prog-${index + 1}`, studentId, sectionId: 's-prog-a', periodId: 'p-2026-1', status: 'active', enrolledAt: '2026-03-10' },
        { _id: `e-db-${index + 1}`, studentId, sectionId: 's-db-a', periodId: 'p-2026-1', status: 'active', enrolledAt: '2026-03-10' }
      ]),
      { _id: 'e-req-1', studentId: 'u-student-1', sectionId: 's-req-a', periodId: 'p-2026-1', status: 'active', enrolledAt: '2026-03-10' },
      { _id: 'e-req-2', studentId: 'u-student-2', sectionId: 's-req-a', periodId: 'p-2026-1', status: 'active', enrolledAt: '2026-03-10' }
    ],
    sessions: [
      { _id: 'ses-1', sectionId: 's-prog-a', date: '2026-04-06', topic: 'Componentes y propiedades', status: 'completed' },
      { _id: 'ses-2', sectionId: 's-prog-a', date: '2026-04-08', topic: 'Estado y eventos', status: 'completed' },
      { _id: 'ses-3', sectionId: 's-db-a', date: '2026-04-07', topic: 'Índices y rendimiento', status: 'completed' }
    ],
    attendance: [
      { _id: 'a-1', sessionId: 'ses-1', studentId: 'u-student-1', status: 'present' },
      { _id: 'a-2', sessionId: 'ses-1', studentId: 'u-student-2', status: 'present' },
      { _id: 'a-3', sessionId: 'ses-1', studentId: 'u-student-3', status: 'late' },
      { _id: 'a-4', sessionId: 'ses-1', studentId: 'u-student-4', status: 'absent' },
      { _id: 'a-5', sessionId: 'ses-2', studentId: 'u-student-1', status: 'present' },
      { _id: 'a-6', sessionId: 'ses-2', studentId: 'u-student-2', status: 'late' },
      { _id: 'a-7', sessionId: 'ses-2', studentId: 'u-student-3', status: 'present' },
      { _id: 'a-8', sessionId: 'ses-2', studentId: 'u-student-4', status: 'present' }
    ],
    evaluations: [
      { _id: 'ev-1', sectionId: 's-prog-a', name: 'Práctica 1', type: 'Práctica', weight: 25, date: '2026-04-10' },
      { _id: 'ev-2', sectionId: 's-prog-a', name: 'Parcial', type: 'Examen', weight: 35, date: '2026-05-08' },
      { _id: 'ev-3', sectionId: 's-prog-a', name: 'Proyecto final', type: 'Proyecto', weight: 40, date: '2026-07-10' },
      { _id: 'ev-4', sectionId: 's-db-a', name: 'Laboratorio 1', type: 'Laboratorio', weight: 30, date: '2026-04-12' }
    ],
    grades: [
      { _id: 'g-1', evaluationId: 'ev-1', studentId: 'u-student-1', score: 18 },
      { _id: 'g-2', evaluationId: 'ev-1', studentId: 'u-student-2', score: 16 },
      { _id: 'g-3', evaluationId: 'ev-1', studentId: 'u-student-3', score: 14 },
      { _id: 'g-4', evaluationId: 'ev-1', studentId: 'u-student-4', score: 17 },
      { _id: 'g-5', evaluationId: 'ev-2', studentId: 'u-student-1', score: 17 },
      { _id: 'g-6', evaluationId: 'ev-2', studentId: 'u-student-2', score: 15 },
      { _id: 'g-7', evaluationId: 'ev-2', studentId: 'u-student-3', score: 13 },
      { _id: 'g-8', evaluationId: 'ev-2', studentId: 'u-student-4', score: 18 }
    ],
    audit: []
  };
}
