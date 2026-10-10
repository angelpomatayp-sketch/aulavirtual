import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { createDemoData } from './demoData.js';

const collections = ['users', 'periods', 'courses', 'sections', 'enrollments', 'sessions', 'attendance', 'evaluations', 'grades', 'audit'];
let mode = process.env.DATA_MODE || (process.env.MONGO_URL ? 'mongo' : 'memory');
let memory = {};
const models = {};

function matches(record, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (Array.isArray(value)) return value.includes(record[key]);
    return record[key] === value;
  });
}

export async function initStore({ reset = false } = {}) {
  if (mode === 'mongo') {
    if (!process.env.MONGO_URL) throw new Error('MONGO_URL es obligatorio cuando DATA_MODE=mongo');
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGO_URL);
    for (const name of collections) {
      models[name] ||= mongoose.models[name] || mongoose.model(name, new mongoose.Schema({ _id: String }, { strict: false, versionKey: false, timestamps: true }), name);
    }
    if (reset) await Promise.all(collections.map((name) => models[name].deleteMany({})));
    if ((await models.users.countDocuments()) === 0) await seedStore();
    else await migrateInstitutionalEmails();
  } else {
    if (reset || !memory.users) memory = await createDemoData();
  }
}

async function migrateInstitutionalEmails() {
  const users = (await models.users.find({}).lean()).filter((user) => !/@continental\.edu\.pe$/i.test(user.email || ''));
  await Promise.all(users.map((user) => {
    const localPart = String(user.email || user.code || user._id).split('@')[0].toLowerCase();
    return models.users.findByIdAndUpdate(user._id, { $set: { email: `${localPart}@continental.edu.pe` } });
  }));
}

export async function seedStore() {
  const data = await createDemoData();
  if (mode === 'mongo') {
    for (const name of collections) {
      await models[name].deleteMany({});
      if (data[name].length) await models[name].insertMany(data[name]);
    }
  } else {
    memory = data;
  }
  return data;
}

export async function all(name, filter = {}) {
  if (mode === 'mongo') return models[name].find(filter).lean();
  return (memory[name] || []).filter((item) => matches(item, filter)).map((item) => ({ ...item }));
}

export async function one(name, filter = {}) {
  if (mode === 'mongo') return models[name].findOne(filter).lean();
  const result = (memory[name] || []).find((item) => matches(item, filter));
  return result ? { ...result } : null;
}

export async function create(name, value) {
  const item = { _id: value._id || randomUUID(), ...value };
  if (mode === 'mongo') return (await models[name].create(item)).toObject();
  memory[name].push(item);
  return { ...item };
}

export async function update(name, id, changes) {
  if (mode === 'mongo') return models[name].findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();
  const index = memory[name].findIndex((item) => item._id === id);
  if (index < 0) return null;
  memory[name][index] = { ...memory[name][index], ...changes, _id: id };
  return { ...memory[name][index] };
}

export async function upsert(name, filter, changes) {
  const existing = await one(name, filter);
  return existing ? update(name, existing._id, changes) : create(name, { ...filter, ...changes });
}

export async function remove(name, id) {
  if (mode === 'mongo') return models[name].findByIdAndDelete(id).lean();
  const index = memory[name].findIndex((item) => item._id === id);
  if (index < 0) return null;
  return memory[name].splice(index, 1)[0];
}

export function storeMode() {
  return mode;
}

export async function closeStore() {
  if (mode === 'mongo' && mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
