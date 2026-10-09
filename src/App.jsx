import { useEffect, useState } from 'react';
import {
  Activity, BarChart3, BookOpen, CalendarDays, Check, ChevronRight, ClipboardCheck,
  Download, GraduationCap, LayoutDashboard, LoaderCircle, LogOut, Menu, Plus,
  Search, ShieldCheck, Sparkles, TrendingUp, Users, X
} from 'lucide-react';

const roleNames = { admin: 'Administrador', teacher: 'Docente', student: 'Estudiante' };
const statusNames = { present: 'Presente', late: 'Tardanza', absent: 'Ausente', justified: 'Justificado' };
const demoAccounts = [
  { role: 'Administrador', email: 'admin@demo.edu.pe', icon: ShieldCheck },
  { role: 'Docente', email: 'docente@demo.edu.pe', icon: BookOpen },
  { role: 'Estudiante', email: 'estudiante@demo.edu.pe', icon: GraduationCap }
];

async function api(path, options = {}) {
  const token = localStorage.getItem('academia_token');
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'No se pudo completar la solicitud.' }));
    throw new Error(error.message);
  }
  if (response.status === 204) return null;
  return response.json();
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@demo.edu.pe');
  const [password, setPassword] = useState('Demo2026!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('academia_token', result.token);
      onLogin(result.user);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return <main className="login-page">
    <section className="login-story">
      <div className="brand light"><span className="brand-mark"><GraduationCap size={25} /></span><span>Aula Norte</span></div>
      <div className="story-copy">
        <span className="eyebrow"><Sparkles size={15} /> Gestión académica, sin fricción</span>
        <h1>Todo el ciclo académico en un solo lugar.</h1>
        <p>Matrículas, asistencia, calificaciones y reportes conectados para que cada decisión llegue a tiempo.</p>
      </div>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="mobile-brand brand"><span className="brand-mark"><GraduationCap size={22} /></span><span>Aula Norte</span></div>
        <span className="overline">Bienvenido</span>
        <h2>Ingresa a tu espacio</h2>
        <p className="muted">Usa tu correo institucional para continuar.</p>
        <label>Correo institucional<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary wide" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : 'Iniciar sesión'} {!loading && <ChevronRight size={18} />}</button>
        <div className="demo-separator"><span>Accesos para demostración</span></div>
        <div className="demo-accounts">
          {demoAccounts.map(({ role, email: account, icon: Icon }) => <button type="button" key={account} onClick={() => { setEmail(account); setPassword('Demo2026!'); }}>
            <Icon size={17} /><span><strong>{role}</strong><small>{account}</small></span>
          </button>)}
        </div>
      </form>
    </section>
  </main>;
}

const navByRole = {
  admin: [
    ['dashboard', 'Resumen', LayoutDashboard], ['users', 'Personas', Users], ['catalog', 'Oferta académica', BookOpen],
    ['enrollments', 'Matrículas', GraduationCap], ['reports', 'Reportes', BarChart3]
  ],
  teacher: [['dashboard', 'Resumen', LayoutDashboard], ['classroom', 'Mis cursos', BookOpen], ['attendance', 'Asistencia', ClipboardCheck], ['grades', 'Calificaciones', BarChart3], ['summary', 'Consolidado', TrendingUp]],
  student: [['dashboard', 'Mi resumen', LayoutDashboard], ['record', 'Mi avance', GraduationCap], ['reports', 'Mi reporte', Download]]
};

function Shell({ user, page, setPage, onLogout, children }) {
  const [open, setOpen] = useState(false);
  const items = navByRole[user.role];
  const title = items.find(([id]) => id === page)?.[1] || 'Resumen';
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><GraduationCap size={22} /></span><span>Aula Norte</span></div>
      <button className="close-menu" onClick={() => setOpen(false)}><X /></button>
      <nav>{items.map(([id, label, Icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setOpen(false); }}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-note"><ShieldCheck size={18} /><div><strong>Entorno seguro</strong><span>Sesión protegida por rol</span></div></div>
      <button className="logout" onClick={onLogout}><LogOut size={18} /> Cerrar sesión</button>
    </aside>
    {open && <button className="scrim" onClick={() => setOpen(false)} />}
    <section className="app-main">
      <header className="topbar">
        <button className="menu-button" onClick={() => setOpen(true)}><Menu /></button>
        <div><span className="breadcrumb">Periodo 2026-I</span><h1>{title}</h1></div>
        <div className="user-chip"><span className="avatar">{user.names[0]}{user.lastNames[0]}</span><div><strong>{user.names} {user.lastNames}</strong><span>{roleNames[user.role]}</span></div></div>
      </header>
      <div className="content">{children}</div>
    </section>
  </div>;
}

function Loading() { return <div className="center-state"><LoaderCircle className="spin" /><span>Cargando información…</span></div>; }
function Empty({ title, text }) { return <div className="empty"><BookOpen /><strong>{title}</strong><span>{text}</span></div>; }
function PageIntro({ eyebrow, title, text, action }) { return <div className="page-intro"><div><span className="overline">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>{action}</div>; }
function StatGrid({ stats = [] }) { return <div className="stat-grid">{stats.map((stat) => <article className={`stat-card ${stat.tone}`} key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small>Periodo actual</small></article>)}</div>; }

function Dashboard({ user }) {
  const [data, setData] = useState(null);
  useEffect(() => { api('/dashboard').then(setData); }, []);
  if (!data) return <Loading />;
  return <>
    <PageIntro eyebrow="Vista general" title={`Buenos días, ${user.names}`} text={user.role === 'student' ? 'Aquí tienes una lectura clara de tu progreso académico.' : 'Revisa el pulso del periodo académico y continúa con las tareas prioritarias.'} />
    <StatGrid stats={data.stats} />
    <div className="dashboard-grid">
      <section className="panel span-2"><div className="panel-head"><div><span className="overline">Periodo activo</span><h3>Secciones en curso</h3></div><CalendarDays /></div>
        <div className="course-list">{data.sections.map((section) => <div className="course-row" key={section._id}><span className="course-code">{section.course?.code}</span><div><strong>{section.course?.name}</strong><span>{section.schedule} · Sección {section.code}</span></div><span className="pill">{section.enrolled} estudiantes</span></div>)}</div>
      </section>
      <section className="panel"><div className="panel-head"><div><span className="overline">Actividad</span><h3>Últimos movimientos</h3></div><Activity /></div>
        <div className="timeline">{data.activity.map((item, index) => <div key={`${item.title}-${index}`}><span className="dot" /><p><strong>{item.title}</strong><span>{item.detail}</span></p><small>{item.time}</small></div>)}</div>
      </section>
    </div>
  </>;
}

function Modal({ title, onClose, children }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h3>{title}</h3><button onClick={onClose}><X /></button></div>{children}</div></div>; }

function UsersPage() {
  const [users, setUsers] = useState([]); const [query, setQuery] = useState(''); const [modal, setModal] = useState(null); const [error, setError] = useState('');
  const load = () => api('/users').then(setUsers); useEffect(() => { load(); }, []);
  const filtered = users.filter((u) => `${u.names} ${u.lastNames} ${u.email} ${u.code}`.toLowerCase().includes(query.toLowerCase()));
  async function saveUser(event) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { if (modal.type === 'create') await api('/users', { method: 'POST', body: JSON.stringify(data) }); else await api(`/users/${modal.user._id}`, { method: 'PATCH', body: JSON.stringify(data) }); setModal(null); load(); } catch (err) { setError(err.message); } }
  async function confirmStatus() { await api(`/users/${modal.user._id}`, { method: 'PATCH', body: JSON.stringify({ status: modal.user.status === 'active' ? 'inactive' : 'active' }) }); setModal(null); load(); }
  return <>
    <PageIntro eyebrow="Directorio" title="Personas y accesos" text="Administra cuentas institucionales y su estado de acceso." action={<button className="button primary" onClick={() => setModal({ type: 'create' })}><Plus size={17} /> Nueva persona</button>} />
    <section className="panel"><div className="toolbar"><label className="search"><Search size={18} /><input placeholder="Buscar por nombre, correo o código" value={query} onChange={(e) => setQuery(e.target.value)} /></label><span>{filtered.length} registros</span></div>
      <div className="table-wrap"><table><thead><tr><th>Persona</th><th>Código</th><th>Perfil</th><th>Estado</th><th /></tr></thead><tbody>{filtered.map((user) => <tr key={user._id}><td><div className="person"><span className="mini-avatar">{user.names[0]}{user.lastNames[0]}</span><div><strong>{user.names} {user.lastNames}</strong><span>{user.email}</span></div></div></td><td>{user.code}</td><td><span className="tag">{roleNames[user.role]}</span></td><td><span className={`status ${user.status}`}>{user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td><td><div className="row-actions"><button className="text-button" onClick={() => setModal({ type: 'view', user })}>Ver</button><button className="text-button" onClick={() => setModal({ type: 'edit', user })}>Editar</button><button className="text-button danger" onClick={() => setModal({ type: 'status', user })}>{user.status === 'active' ? 'Desactivar' : 'Activar'}</button></div></td></tr>)}</tbody></table></div>
    </section>
    {modal?.type === 'view' && <Modal title="Detalle de la persona" onClose={() => setModal(null)}><div className="detail-list"><div><span>Nombre</span><strong>{modal.user.names} {modal.user.lastNames}</strong></div><div><span>Correo</span><strong>{modal.user.email}</strong></div><div><span>Código</span><strong>{modal.user.code}</strong></div><div><span>Perfil</span><strong>{roleNames[modal.user.role]}</strong></div><div><span>Estado</span><strong>{modal.user.status === 'active' ? 'Activo' : 'Inactivo'}</strong></div></div><div className="modal-actions"><button className="button primary" onClick={() => setModal(null)}>Cerrar</button></div></Modal>}
    {(modal?.type === 'create' || modal?.type === 'edit') && <Modal title={modal.type === 'create' ? 'Registrar persona' : 'Editar persona'} onClose={() => setModal(null)}><form className="form-grid" onSubmit={saveUser}><label>Nombres<input name="names" defaultValue={modal.user?.names} required /></label><label>Apellidos<input name="lastNames" defaultValue={modal.user?.lastNames} required /></label>{modal.type === 'create' && <label>Correo<input name="email" type="email" required /></label>}<label>Código<input name="code" defaultValue={modal.user?.code} required /></label>{modal.type === 'create' && <label className="full">Perfil<select name="role"><option value="student">Estudiante</option><option value="teacher">Docente</option><option value="admin">Administrador</option></select></label>}{error && <p className="form-error full">{error}</p>}<div className="modal-actions full"><button type="button" className="button ghost" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Guardar persona</button></div></form></Modal>}
    {modal?.type === 'status' && <Modal title={modal.user.status === 'active' ? 'Desactivar cuenta' : 'Activar cuenta'} onClose={() => setModal(null)}><p>¿Confirmas el cambio de estado para <strong>{modal.user.names} {modal.user.lastNames}</strong>?</p><div className="modal-actions"><button className="button ghost" onClick={() => setModal(null)}>Cancelar</button><button className="button primary" onClick={confirmStatus}>Confirmar</button></div></Modal>}
  </>;
}

function CatalogPage() {
  const [data, setData] = useState(null); const [modal, setModal] = useState(null); const [error, setError] = useState('');
  const load = () => api('/catalog').then(setData); useEffect(() => { load(); }, []);
  if (!data) return <Loading />;
  async function saveCourse(event) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); try { const editing = modal.type === 'editCourse'; await api(editing ? `/courses/${modal.item._id}` : '/courses', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) }); setModal(null); load(); } catch (err) { setError(err.message); } }
  async function saveSection(event) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); try { const editing = modal.type === 'editSection'; await api(editing ? `/sections/${modal.item._id}` : '/sections', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) }); setModal(null); load(); } catch (err) { setError(err.message); } }
  async function confirmDelete() { try { await api(`/${modal.entity}/${modal.item._id}`, { method: 'DELETE' }); setModal(null); load(); } catch (err) { setError(err.message); } }
  return <>
    <PageIntro eyebrow="Configuración" title="Oferta académica" text="Cursos y secciones disponibles en el periodo 2026-I." action={<div className="action-group"><button className="button secondary" onClick={() => setModal({ type: 'createSection' })}><Plus size={17} /> Nueva sección</button><button className="button primary" onClick={() => setModal({ type: 'createCourse' })}><Plus size={17} /> Nuevo curso</button></div>} />
    <div className="card-grid">{data.courses.map((course) => { const sections = data.sections.filter((s) => s.courseId === course._id); return <article className="course-card" key={course._id}><div className="course-card-top"><span>{course.code}</span><div className="card-actions"><button onClick={() => setModal({ type: 'viewCourse', item: course })}>Ver</button><button onClick={() => setModal({ type: 'editCourse', item: course })}>Editar</button><button onClick={() => setModal({ type: 'delete', entity: 'courses', item: course })}>Eliminar</button></div></div><h3>{course.name}</h3><p>{course.credits} créditos · {course.hours} horas semanales</p><div className="course-sections">{sections.length ? sections.map((s) => <div className="section-line" key={s._id}><span>Sección {s.code}</span><strong>{s.teacher?.names} {s.teacher?.lastNames}</strong><small>{s.schedule}</small><div className="card-actions section-actions"><button onClick={() => setModal({ type: 'viewSection', item: s })}>Ver</button><button onClick={() => setModal({ type: 'editSection', item: s })}>Editar</button><button onClick={() => setModal({ type: 'delete', entity: 'sections', item: s })}>Eliminar</button></div></div>) : <span className="muted">Sin secciones configuradas</span>}</div></article>; })}</div>
    {['viewCourse', 'viewSection'].includes(modal?.type) && <Modal title={modal.type === 'viewCourse' ? 'Detalle del curso' : 'Detalle de la sección'} onClose={() => setModal(null)}><div className="detail-list">{modal.type === 'viewCourse' ? <><div><span>Código</span><strong>{modal.item.code}</strong></div><div><span>Nombre</span><strong>{modal.item.name}</strong></div><div><span>Créditos</span><strong>{modal.item.credits}</strong></div><div><span>Horas</span><strong>{modal.item.hours}</strong></div></> : <><div><span>Curso</span><strong>{modal.item.course?.name}</strong></div><div><span>Sección</span><strong>{modal.item.code}</strong></div><div><span>Docente</span><strong>{modal.item.teacher?.names} {modal.item.teacher?.lastNames}</strong></div><div><span>Horario</span><strong>{modal.item.schedule}</strong></div><div><span>Capacidad</span><strong>{modal.item.capacity}</strong></div></>}</div><div className="modal-actions"><button className="button primary" onClick={() => setModal(null)}>Cerrar</button></div></Modal>}
    {['createCourse', 'editCourse'].includes(modal?.type) && <Modal title={modal.type === 'createCourse' ? 'Crear curso' : 'Editar curso'} onClose={() => setModal(null)}><form className="form-grid" onSubmit={saveCourse}><div className="auto-code-note full"><span>Código del curso</span><strong>{modal.item?.code || 'Se asignará automáticamente al guardar'}</strong></div><label className="full">Nombre<input name="name" defaultValue={modal.item?.name} required /></label><label>Créditos<input name="credits" type="number" min="1" max="10" defaultValue={modal.item?.credits || 3} required /></label><label>Horas semanales<input name="hours" type="number" min="1" max="20" defaultValue={modal.item?.hours || 4} required /></label>{error && <p className="form-error full">{error}</p>}<div className="modal-actions full"><button type="button" className="button ghost" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Guardar curso</button></div></form></Modal>}
    {['createSection', 'editSection'].includes(modal?.type) && <Modal title={modal.type === 'createSection' ? 'Crear sección' : 'Editar sección'} onClose={() => setModal(null)}><form className="form-grid" onSubmit={saveSection}>{modal.type === 'createSection' && <><label className="full">Curso<select name="courseId">{data.courses.map((c) => <option value={c._id} key={c._id}>{c.code} · {c.name}</option>)}</select></label><input type="hidden" name="periodId" value={data.periods[0]?._id} /></>}<label>Sección<input name="code" defaultValue={modal.item?.code || 'A'} required /></label><label>Capacidad<input name="capacity" type="number" min="1" max="100" defaultValue={modal.item?.capacity || 30} required /></label><label className="full">Docente<select name="teacherId" defaultValue={modal.item?.teacherId}>{data.teachers.map((t) => <option value={t._id} key={t._id}>{t.names} {t.lastNames}</option>)}</select></label><label className="full">Horario<input name="schedule" defaultValue={modal.item?.schedule} placeholder="Lun y Mié · 09:00" required /></label>{error && <p className="form-error full">{error}</p>}<div className="modal-actions full"><button type="button" className="button ghost" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Guardar sección</button></div></form></Modal>}
    {modal?.type === 'delete' && <Modal title="Confirmar eliminación" onClose={() => setModal(null)}><p>Esta acción eliminará <strong>{modal.item.name || `la sección ${modal.item.code}`}</strong>. Solo se permitirá si no tiene registros relacionados.</p>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="button ghost" onClick={() => setModal(null)}>Cancelar</button><button className="button danger-button" onClick={confirmDelete}>Eliminar</button></div></Modal>}
  </>;
}

function EnrollmentsPage() {
  const [rows, setRows] = useState([]); const [catalog, setCatalog] = useState(null); const [students, setStudents] = useState([]); const [modal, setModal] = useState(null); const [error, setError] = useState('');
  const load = () => Promise.all([api('/enrollments'), api('/catalog'), api('/users?role=student')]).then(([a, b, c]) => { setRows(a); setCatalog(b); setStudents(c); }); useEffect(() => { load(); }, []);
  async function enroll(event) { event.preventDefault(); try { await api('/enrollments', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); setModal(null); load(); } catch (err) { setError(err.message); } }
  async function cancelEnrollment() { await api(`/enrollments/${modal.item._id}`, { method: 'DELETE' }); setModal(null); load(); }
  return <><PageIntro eyebrow="Proceso académico" title="Matrículas" text="Controla la asignación de estudiantes a secciones activas." action={<button className="button primary" onClick={() => setModal({ type: 'create' })}><Plus size={17} /> Nueva matrícula</button>} />
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Estudiante</th><th>Curso</th><th>Sección</th><th>Fecha</th><th>Estado</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td><div className="person"><span className="mini-avatar">{row.student.names?.[0]}{row.student.lastNames?.[0]}</span><div><strong>{row.student.names} {row.student.lastNames}</strong><span>{row.student.code}</span></div></div></td><td>{row.section?.course?.name}</td><td>{row.section?.code}</td><td>{row.enrolledAt}</td><td><span className="status active">Activa</span></td><td><div className="row-actions"><button className="text-button" onClick={() => setModal({ type: 'view', item: row })}>Ver</button><button className="text-button danger" onClick={() => setModal({ type: 'delete', item: row })}>Retirar</button></div></td></tr>)}</tbody></table></div></section>
    {modal?.type === 'create' && catalog && <Modal title="Registrar matrícula" onClose={() => setModal(null)}><form className="form-grid" onSubmit={enroll}><label className="full">Estudiante<select name="studentId">{students.map((s) => <option value={s._id} key={s._id}>{s.names} {s.lastNames} · {s.code}</option>)}</select></label><label className="full">Sección<select name="sectionId">{catalog.sections.map((s) => <option value={s._id} key={s._id}>{s.course?.name} · Sección {s.code} · {s.schedule}</option>)}</select></label>{error && <p className="form-error full">{error}</p>}<div className="modal-actions full"><button type="button" className="button ghost" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Matricular</button></div></form></Modal>}
    {modal?.type === 'view' && <Modal title="Detalle de matrícula" onClose={() => setModal(null)}><div className="detail-list"><div><span>Estudiante</span><strong>{modal.item.student.names} {modal.item.student.lastNames}</strong></div><div><span>Curso</span><strong>{modal.item.section?.course?.name}</strong></div><div><span>Sección</span><strong>{modal.item.section?.code}</strong></div><div><span>Horario</span><strong>{modal.item.section?.schedule}</strong></div><div><span>Fecha</span><strong>{modal.item.enrolledAt}</strong></div></div><div className="modal-actions"><button className="button primary" onClick={() => setModal(null)}>Cerrar</button></div></Modal>}
    {modal?.type === 'delete' && <Modal title="Retirar matrícula" onClose={() => setModal(null)}><p>¿Confirmas el retiro de <strong>{modal.item.student.names} {modal.item.student.lastNames}</strong> de {modal.item.section?.course?.name}?</p><div className="modal-actions"><button className="button ghost" onClick={() => setModal(null)}>Cancelar</button><button className="button danger-button" onClick={cancelEnrollment}>Confirmar retiro</button></div></Modal>}
  </>;
}

function Classroom({ mode }) {
  const [catalog, setCatalog] = useState(null); const [selected, setSelected] = useState(''); const [workspace, setWorkspace] = useState(null); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState(''); const [modal, setModal] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api('/catalog').then((data) => { setCatalog(data); if (data.sections[0]) setSelected(data.sections[0]._id); }); }, []);
  const loadWorkspace = () => selected && api(`/sections/${selected}/workspace`).then(setWorkspace).catch(() => setWorkspace(null));
  useEffect(() => { loadWorkspace(); }, [selected]);
  const [attendance, setAttendance] = useState({}); const [gradeValues, setGradeValues] = useState({});
  useEffect(() => { if (workspace) { setAttendance(Object.fromEntries(workspace.students.map((s) => [s._id, workspace.attendance.find((a) => a.studentId === s._id)?.status || 'present']))); setGradeValues(Object.fromEntries(workspace.grades.map((g) => [`${g.evaluationId}:${g.studentId}`, g.score]))); } }, [workspace]);
  if (!catalog) return <Loading />;
  const section = catalog.sections.find((s) => s._id === selected);
  async function saveAttendance() { if (!workspace.sessions[0]) return setNotice('Primero registra una sesión.'); setSaving(true); await api(`/sessions/${workspace.sessions[0]._id}/attendance`, { method: 'PUT', body: JSON.stringify({ records: workspace.students.map((s) => ({ studentId: s._id, status: attendance[s._id] })) }) }); setSaving(false); setNotice('Asistencia guardada correctamente.'); }
  async function saveGrades(evaluationId) { setSaving(true); await api(`/evaluations/${evaluationId}/grades`, { method: 'PUT', body: JSON.stringify({ records: workspace.students.map((s) => ({ studentId: s._id, score: Number(gradeValues[`${evaluationId}:${s._id}`] || 0) })) }) }); setSaving(false); setNotice('Calificaciones guardadas correctamente.'); }
  async function saveRecord(event) { event.preventDefault(); const body = { ...Object.fromEntries(new FormData(event.currentTarget)), sectionId: selected }; const isSession = modal.entity === 'sessions'; const editing = modal.type === 'edit'; const path = editing ? `/${modal.entity}/${modal.item._id}` : `/${modal.entity}`; try { await api(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) }); setModal(null); setNotice(isSession ? 'Sesión guardada correctamente.' : 'Evaluación guardada correctamente.'); loadWorkspace(); } catch (err) { setError(err.message); } }
  async function deleteRecord() { try { await api(`/${modal.entity}/${modal.item._id}`, { method: 'DELETE' }); setModal(null); loadWorkspace(); } catch (err) { setError(err.message); } }
  return <><PageIntro eyebrow="Espacio docente" title={mode === 'attendance' ? 'Control de asistencia' : mode === 'grades' ? 'Libro de calificaciones' : 'Mis cursos'} text="Selecciona una sección y registra la información académica." />
    <div className="section-tabs">{catalog.sections.map((s) => <button key={s._id} className={selected === s._id ? 'active' : ''} onClick={() => setSelected(s._id)}><span>{s.course?.code}</span><strong>{s.course?.name}</strong><small>Sección {s.code}</small></button>)}</div>
    {section && workspace && <section className="panel class-panel"><div className="class-heading"><div><span className="overline">{section.course?.code} · Sección {section.code}</span><h3>{section.course?.name}</h3><p>{section.schedule} · {workspace.students.length} estudiantes</p></div><div className="class-actions">{notice && <span className="success-note"><Check size={16} /> {notice}</span>}{mode === 'attendance' && <button className="button secondary" onClick={() => setModal({ type: 'create', entity: 'sessions' })}><Plus size={16} /> Nueva sesión</button>}{mode === 'grades' && <button className="button secondary" onClick={() => setModal({ type: 'create', entity: 'evaluations' })}><Plus size={16} /> Nueva evaluación</button>}</div></div>
      {mode === 'attendance' && <><div className="record-strip">{workspace.sessions.map((session) => <div key={session._id}><span><strong>{session.date}</strong>{session.topic}</span><div className="card-actions"><button onClick={() => setModal({ type: 'view', entity: 'sessions', item: session })}>Ver</button><button onClick={() => setModal({ type: 'edit', entity: 'sessions', item: session })}>Editar</button><button onClick={() => setModal({ type: 'delete', entity: 'sessions', item: session })}>Eliminar</button></div></div>)}</div><div className="subheading"><div><h4>Asistencia de la sesión más reciente</h4><p>{workspace.sessions[0]?.date || 'Sin sesiones'} · {workspace.sessions[0]?.topic || 'Registra la primera sesión'}</p></div><button className="button primary" onClick={saveAttendance} disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Check />} Guardar asistencia</button></div><div className="roster">{workspace.students.map((student) => <div key={student._id}><div className="person"><span className="mini-avatar">{student.names[0]}{student.lastNames[0]}</span><div><strong>{student.names} {student.lastNames}</strong><span>{student.code}</span></div></div><div className="attendance-options">{Object.entries(statusNames).map(([value, label]) => <button className={attendance[student._id] === value ? `selected ${value}` : ''} key={value} onClick={() => setAttendance({ ...attendance, [student._id]: value })}>{label}</button>)}</div></div>)}</div></>}
      {mode === 'grades' && <div className="gradebook">{workspace.evaluations.map((evaluation) => <div className="evaluation-block" key={evaluation._id}><div className="evaluation-head"><div><h4>{evaluation.name}</h4><span>{evaluation.type} · {evaluation.weight}% · {evaluation.date}</span></div><div className="evaluation-actions"><div className="card-actions"><button onClick={() => setModal({ type: 'view', entity: 'evaluations', item: evaluation })}>Ver</button><button onClick={() => setModal({ type: 'edit', entity: 'evaluations', item: evaluation })}>Editar</button><button onClick={() => setModal({ type: 'delete', entity: 'evaluations', item: evaluation })}>Eliminar</button></div><button className="button secondary" onClick={() => saveGrades(evaluation._id)}>Guardar notas</button></div></div><div className="grade-grid">{workspace.students.map((student) => <label key={student._id}><span>{student.names} {student.lastNames}</span><input type="number" min="0" max="20" step="0.1" value={gradeValues[`${evaluation._id}:${student._id}`] ?? ''} onChange={(e) => setGradeValues({ ...gradeValues, [`${evaluation._id}:${student._id}`]: e.target.value })} /></label>)}</div></div>)}</div>}
      {mode === 'classroom' && <div className="summary-columns"><div><span className="metric-icon"><Users /></span><strong>{workspace.students.length}</strong><span>estudiantes matriculados</span></div><div><span className="metric-icon"><ClipboardCheck /></span><strong>{workspace.sessions.length}</strong><span>sesiones registradas</span></div><div><span className="metric-icon"><BarChart3 /></span><strong>{workspace.evaluations.length}</strong><span>evaluaciones creadas</span></div></div>}
    </section>}
    {modal?.type === 'view' && <Modal title={modal.entity === 'sessions' ? 'Detalle de la sesión' : 'Detalle de la evaluación'} onClose={() => setModal(null)}><div className="detail-list">{modal.entity === 'sessions' ? <><div><span>Fecha</span><strong>{modal.item.date}</strong></div><div><span>Tema</span><strong>{modal.item.topic}</strong></div></> : <><div><span>Nombre</span><strong>{modal.item.name}</strong></div><div><span>Tipo</span><strong>{modal.item.type}</strong></div><div><span>Ponderación</span><strong>{modal.item.weight}%</strong></div><div><span>Fecha</span><strong>{modal.item.date}</strong></div></>}</div><div className="modal-actions"><button className="button primary" onClick={() => setModal(null)}>Cerrar</button></div></Modal>}
    {(modal?.type === 'create' || modal?.type === 'edit') && <Modal title={`${modal.type === 'create' ? 'Crear' : 'Editar'} ${modal.entity === 'sessions' ? 'sesión' : 'evaluación'}`} onClose={() => setModal(null)}><form className="form-grid" onSubmit={saveRecord}>{modal.entity === 'sessions' ? <><label className="full">Fecha<input name="date" type="date" defaultValue={modal.item?.date || new Date().toISOString().slice(0, 10)} required /></label><label className="full">Tema<input name="topic" defaultValue={modal.item?.topic} required /></label></> : <><label>Nombre<input name="name" defaultValue={modal.item?.name} required /></label><label>Tipo<select name="type" defaultValue={modal.item?.type || 'Práctica'}><option>Práctica</option><option>Examen</option><option>Proyecto</option><option>Laboratorio</option></select></label><label>Ponderación<input name="weight" type="number" min="1" max="100" defaultValue={modal.item?.weight || 20} required /></label><label>Fecha<input name="date" type="date" defaultValue={modal.item?.date || new Date().toISOString().slice(0, 10)} required /></label></>}{error && <p className="form-error full">{error}</p>}<div className="modal-actions full"><button type="button" className="button ghost" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Guardar</button></div></form></Modal>}
    {modal?.type === 'delete' && <Modal title="Confirmar eliminación" onClose={() => setModal(null)}><p>Se eliminará <strong>{modal.item.topic || modal.item.name}</strong> y sus registros asociados.</p>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="button ghost" onClick={() => setModal(null)}>Cancelar</button><button className="button danger-button" onClick={deleteRecord}>Eliminar</button></div></Modal>}
  </>;
}

function GradeSummary() {
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState('');
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api('/catalog').then((data) => {
      setCatalog(data);
      if (data.sections[0]) setSelected(data.sections[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setSummary(null);
    api(`/sections/${selected}/grade-summary`).then(setSummary);
  }, [selected]);

  if (!catalog) return <Loading />;
  if (!catalog.sections.length) return <Empty title="Sin secciones asignadas" text="Cuando tengas una sección asignada, su consolidado aparecerá aquí." />;
  const stats = summary ? [
    { label: 'Promedio de sección', value: summary.stats.sectionAverage ?? '—', tone: 'teal' },
    { label: 'Avance evaluado', value: `${summary.stats.evaluatedWeight}%`, tone: 'blue' },
    { label: 'Aprobando', value: summary.stats.passing, tone: 'amber' },
    { label: 'En riesgo', value: summary.stats.atRisk, tone: 'violet' }
  ] : [];
  return <>
    <PageIntro eyebrow="Seguimiento académico" title="Consolidado de notas" text="Analiza el avance, el acumulado y la situación de cada estudiante en una sola vista." />
    <div className="section-tabs">{catalog.sections.map((section) => <button key={section._id} className={selected === section._id ? 'active' : ''} onClick={() => setSelected(section._id)}><span>{section.course?.code}</span><strong>{section.course?.name}</strong><small>Sección {section.code}</small></button>)}</div>
    {!summary ? <Loading /> : <>
      <StatGrid stats={stats} />
      <section className="panel summary-panel">
        <div className="panel-head"><div><span className="overline">{summary.section.course?.code} · Sección {summary.section.code}</span><h3>Avance de estudiantes</h3></div><span className="progress-label">{summary.stats.evaluatedWeight}% del curso evaluado</span></div>
        <div className="progress-track"><span style={{ width: `${Math.min(summary.stats.evaluatedWeight, 100)}%` }} /></div>
        <div className="table-wrap"><table className="summary-table"><thead><tr><th>Estudiante</th>{summary.evaluations.map((evaluation) => <th key={evaluation._id}>{evaluation.name}<small>{evaluation.weight}%</small></th>)}<th>Prom. actual</th><th>Acumulado</th><th>Asistencia</th><th>Estado</th><th /></tr></thead><tbody>{summary.rows.map((row) => <tr key={row.student._id}><td><div className="person"><span className="mini-avatar">{row.student.names?.[0]}{row.student.lastNames?.[0]}</span><div><strong>{row.student.names} {row.student.lastNames}</strong><span>{row.student.code}</span></div></div></td>{summary.evaluations.map((evaluation) => <td key={evaluation._id}>{row.scores[evaluation._id] ?? <span className="pending-grade">—</span>}</td>)}<td><strong>{row.currentAverage ?? '—'}</strong></td><td>{row.accumulated}</td><td>{row.attendance === null ? '—' : `${row.attendance}%`}</td><td><span className={`summary-status ${row.status.toLowerCase().replaceAll(' ', '-')}`}>{row.status}</span></td><td><button className="text-button" onClick={() => setDetail(row)}>Ver detalle</button></td></tr>)}</tbody></table></div>
      </section>
    </>}
    {detail && <Modal title="Detalle del avance" onClose={() => setDetail(null)}><div className="student-detail-head"><span className="avatar large">{detail.student.names?.[0]}{detail.student.lastNames?.[0]}</span><div><h3>{detail.student.names} {detail.student.lastNames}</h3><p>{detail.student.code} · {summary.section.course?.name}</p></div></div><div className="detail-list"><div><span>Promedio actual</span><strong>{detail.currentAverage ?? 'Sin notas'}</strong></div><div><span>Acumulado final</span><strong>{detail.accumulated} de 20</strong></div><div><span>Avance evaluado</span><strong>{detail.completedWeight}%</strong></div><div><span>Asistencia</span><strong>{detail.attendance === null ? 'Sin registro' : `${detail.attendance}%`}</strong></div><div><span>Nota mínima pendiente</span><strong>{detail.requiredScore === null ? 'Curso completo' : detail.canPass ? detail.requiredScore : 'No alcanzable'}</strong></div><div><span>Situación</span><strong>{detail.status}</strong></div></div><div className="evaluation-detail">{summary.evaluations.map((evaluation) => <div key={evaluation._id}><span>{evaluation.name}<small>{evaluation.weight}%</small></span><strong>{detail.scores[evaluation._id] ?? 'Pendiente'}</strong></div>)}</div><div className="modal-actions"><button className="button primary" onClick={() => setDetail(null)}>Cerrar</button></div></Modal>}
  </>;
}

function StudentProgress() {
  const [progress, setProgress] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api('/student/progress').then(setProgress);
  }, []);

  if (!progress) return <Loading />;
  const stats = [
    { label: 'Cursos matriculados', value: progress.stats.enrolled, tone: 'teal' },
    { label: 'Promedio actual', value: progress.stats.overallAverage ?? '—', tone: 'blue' },
    { label: 'Asistencia promedio', value: progress.stats.averageAttendance === null ? '—' : `${progress.stats.averageAttendance}%`, tone: 'amber' },
    { label: 'Cursos en riesgo', value: progress.stats.atRisk, tone: 'violet' }
  ];
  return <>
    <PageIntro eyebrow="Seguimiento personal" title="Mi avance académico" text="Revisa cómo vas en cada curso, cuánto se ha evaluado y qué necesitas para alcanzar la nota aprobatoria." />
    <StatGrid stats={stats} />
    {progress.courses.length ? <div className="student-progress-grid">{progress.courses.map((item) => <article className="progress-course-card" key={item.enrollmentId}>
      <div className="course-progress-head"><div><span className="overline">{item.course.code} · Sección {item.section.code}</span><h3>{item.course.name}</h3><p>{item.section.schedule}</p></div><span className={`summary-status ${item.status.toLowerCase().replaceAll(' ', '-')}`}>{item.status}</span></div>
      <div className="progress-caption"><span>Avance evaluado</span><strong>{item.completedWeight}%</strong></div>
      <div className="progress-track"><span style={{ width: `${Math.min(item.completedWeight, 100)}%` }} /></div>
      <div className="course-progress-metrics"><div><span>Promedio actual</span><strong>{item.currentAverage ?? '—'}</strong></div><div><span>Acumulado</span><strong>{item.accumulated} / 20</strong></div><div><span>Asistencia</span><strong>{item.attendance === null ? '—' : `${item.attendance}%`}</strong></div></div>
      <div className="student-evaluations">{item.evaluations.slice(0, 3).map((evaluation) => <div className="student-evaluation-row" key={evaluation._id}><span><strong>{evaluation.name}</strong><small>{evaluation.weight}% · {evaluation.date}</small></span><b className={evaluation.score === null ? 'pending-grade' : ''}>{evaluation.score ?? 'Pendiente'}</b></div>)}</div>
      <button className="button secondary progress-detail-button" onClick={() => setDetail(item)}>Ver detalle del curso</button>
    </article>)}</div> : <Empty title="Aún no tienes cursos" text="Tus cursos y avances aparecerán aquí cuando tengas una matrícula activa." />}
    {detail && <Modal title="Detalle de mi avance" onClose={() => setDetail(null)}><div className="student-detail-head"><span className="avatar large">{detail.course.code?.slice(0, 2)}</span><div><h3>{detail.course.name}</h3><p>{detail.course.code} · Sección {detail.section.code}</p></div></div><div className="detail-list"><div><span>Promedio actual</span><strong>{detail.currentAverage ?? 'Sin notas'}</strong></div><div><span>Acumulado final</span><strong>{detail.accumulated} de 20</strong></div><div><span>Avance evaluado</span><strong>{detail.completedWeight}%</strong></div><div><span>Asistencia</span><strong>{detail.attendance === null ? 'Sin registro' : `${detail.attendance}%`}</strong></div><div><span>Nota necesaria en lo pendiente</span><strong>{detail.requiredScore === null ? 'Curso completo' : detail.requiredScore > 20 ? 'No alcanzable' : detail.requiredScore}</strong></div><div><span>Situación</span><strong>{detail.status}</strong></div></div><div className="evaluation-detail">{detail.evaluations.map((evaluation) => <div key={evaluation._id}><span>{evaluation.name}<small>{evaluation.type} · {evaluation.weight}%</small></span><strong>{evaluation.score ?? 'Pendiente'}</strong></div>)}</div><div className="modal-actions"><button className="button primary" onClick={() => setDetail(null)}>Cerrar</button></div></Modal>}
  </>;
}

function Reports({ user }) {
  const [students, setStudents] = useState([]); const [selected, setSelected] = useState(user.role === 'student' ? user._id : ''); const [report, setReport] = useState(null);
  useEffect(() => { if (user.role === 'admin') api('/users?role=student').then((items) => { setStudents(items); if (items[0]) setSelected(items[0]._id); }); }, [user.role]);
  useEffect(() => { if (selected) api(`/reports/academic?studentId=${selected}`).then(setReport); }, [selected]);
  function download(format) { const token = localStorage.getItem('academia_token'); fetch(`/api/reports/academic?studentId=${selected}&format=${format}`, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => { const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reporte-academico.${format}`; a.click(); URL.revokeObjectURL(url); }); }
  return <><PageIntro eyebrow="Resultados" title={user.role === 'student' ? 'Mi reporte académico' : 'Reportes académicos'} text="Consulta y descarga información consolidada del periodo." action={report && <div className="action-group"><button className="button secondary" onClick={() => download('xls')}><Download size={17} /> Excel</button><button className="button primary" onClick={() => download('pdf')}><Download size={17} /> PDF</button></div>} />
    {user.role === 'admin' && <label className="report-select">Estudiante<select value={selected} onChange={(e) => setSelected(e.target.value)}>{students.map((s) => <option value={s._id} key={s._id}>{s.names} {s.lastNames} · {s.code}</option>)}</select></label>}
    {report ? <section className="panel report-card"><div className="report-identity"><span className="avatar large">{report.student.names[0]}{report.student.lastNames[0]}</span><div><span className="overline">Reporte individual</span><h3>{report.student.names} {report.student.lastNames}</h3><p>{report.student.code} · Periodo 2026-I</p></div></div><div className="table-wrap"><table><thead><tr><th>Curso</th><th>Sección</th><th>Promedio</th><th>Asistencia</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.Curso}><td><strong>{row.Curso}</strong></td><td>{row.Sección}</td><td><span className="score">{row.Promedio}</span></td><td>{row.Asistencia}</td></tr>)}</tbody></table></div></section> : <Loading />}
  </>;
}

function App() {
  const [user, setUser] = useState(null); const [checking, setChecking] = useState(true); const [page, setPage] = useState('dashboard');
  useEffect(() => {
    const token = localStorage.getItem('academia_token');
    if (!token) {
      setChecking(false);
      return undefined;
    }
    let active = true;
    api('/auth/me')
      .then(({ user: sessionUser }) => { if (active) setUser(sessionUser); })
      .catch(() => { if (active) localStorage.removeItem('academia_token'); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  async function logout() { await api('/auth/logout', { method: 'POST' }).catch(() => null); localStorage.removeItem('academia_token'); setUser(null); setPage('dashboard'); }
  if (checking) return <Loading />;
  if (!user) return <Login onLogin={setUser} />;
  let content = <Dashboard user={user} />;
  if (page === 'users') content = <UsersPage />;
  if (page === 'catalog') content = <CatalogPage />;
  if (page === 'enrollments') content = <EnrollmentsPage />;
  if (['classroom', 'attendance', 'grades'].includes(page)) content = <Classroom mode={page} />;
  if (page === 'summary') content = <GradeSummary />;
  if (page === 'record') content = <StudentProgress />;
  if (page === 'reports') content = <Reports user={user} />;
  return <Shell user={user} page={page} setPage={setPage} onLogout={logout}>{content}</Shell>;
}

export default App;
