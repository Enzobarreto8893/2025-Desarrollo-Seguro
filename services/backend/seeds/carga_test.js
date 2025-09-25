/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
const bcrypt = require('bcrypt');

exports.seed = async function (knex) {
  // Limpiar tablas antes de insertar para evitar duplicados
  await knex('invoices').del();
  await knex('users').del();

  // Leer contraseñas desde variables de entorno (o usar fallback solo en local)
  const testPass = process.env.TEST_ADMIN_PASS || 'local_dev_password_only';
  const prodPass = process.env.PROD_ADMIN_PASS || 'local_dev_password_only';

  // Hashear contraseñas
  const hashedTestPassword = await bcrypt.hash(testPass, 10);
  const hashedProdPassword = await bcrypt.hash(prodPass, 10);

  // Insertar usuarios (sin hardcodear IDs)
  const [testUserId] = await knex('users')
    .insert({
      username: 'test',
      email: 'test@example.local',
      password: hashedTestPassword,
      first_name: 'Test',
      last_name: 'User',
      activated: true,
    })
    .returning('id');

  const [prodUserId] = await knex('users')
    .insert({
      username: 'prod',
      email: 'prod@example.local',
      password: hashedProdPassword,
      first_name: 'Prod',
      last_name: 'User',
      activated: true,
    })
    .returning('id');

  // Insertar facturas
  await knex('invoices').insert([
    {
      userId: testUserId.id || testUserId,
      amount: 101.0,
      dueDate: new Date('2025-01-01'),
      status: 'unpaid',
    },
    {
      userId: testUserId.id || testUserId,
      amount: 102.0,
      dueDate: new Date('2025-01-01'),
      status: 'paid',
    },
    {
      userId: testUserId.id || testUserId,
      amount: 103.0,
      dueDate: new Date('2025-01-01'),
      status: 'paid',
    },
    {
      userId: prodUserId.id || prodUserId,
      amount: 99.0,
      dueDate: new Date('2025-01-01'),
      status: 'unpaid',
    },
  ]);
};