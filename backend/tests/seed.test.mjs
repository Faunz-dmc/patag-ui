import test from 'node:test';
import assert from 'node:assert/strict';
import { database, ids } from './database.mjs';
import { seedAdmin } from '../seed-admin.mjs';
test('admin seed requires a strong password, creates Auth/profile once, and only resets explicitly',async()=>{
  const pool=await database();let creates=0,resets=0;const users=[];
  const auth={listUsers:async()=>({users}),createUser:async body=>{creates++;const user={id:ids.admin,email:body.email};users.push(user);await pool.db.query('INSERT INTO auth.users VALUES($1,$2)',[user.id,user.email]);return user;},updateUser:async()=>{resets++;},deleteUser:async()=>{}};
  try {
    await assert.rejects(seedAdmin(pool,auth,{password:undefined}),/Password/);
    await assert.rejects(seedAdmin(pool,auth,{password:'short'}),/Password/);
    await seedAdmin(pool,auth,{password:'private test password supplied by test'});
    await seedAdmin(pool,auth,{password:'private test password supplied by test'});
    assert.equal(creates,1);assert.equal(resets,0);
    const profile=(await pool.db.query('SELECT role,active,municipality,name FROM public.patag_profiles')).rows[0];
    assert.deepEqual(profile,{role:'administrator',active:true,municipality:null,name:'PATAG Test Administrator'});
    await seedAdmin(pool,auth,{password:'changed private test password',reset:true});assert.equal(resets,1);
  }finally{await pool.end();}
});
