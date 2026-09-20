import { User, IUser, mockedPreHook } from './lib/user.model';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import transient from '../src';

describe('Mongoose Transient', () => {
  let replSet: MongoMemoryReplSet;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });

    await mongoose.connect(replSet.getUri());
  });

  // The hook spy is module-level and shared by every test in this file, so
  // without a reset the call count depends on which tests ran first.
  beforeEach(() => {
    mockedPreHook.mockClear();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    // Optional-chained: if beforeAll threw before create() resolved, replSet is
    // undefined and an unguarded .stop() would mask the real failure.
    await replSet?.stop();
  });

  it('should create a new User', () => {
    const user = new User();

    expect(user).toBeInstanceOf(User);
  });

  it('should create virtual properties', () => {
    const user = new User({
      name: 'Bart',
      confirmationPassword: 'password',
      another: 'thing',
    });

    expect(user.password).not.toBeDefined();
    expect(user.confirmationPassword).toBeDefined();
    expect(user.addOne).toBeDefined();
    expect(user.isBrilliant).toBeDefined();
    expect(user.another).toBeDefined();
  });

  it('should not have virtual properties on plain objects', () => {
    const user = new User({
      name: 'Bart',
      password: 'eat!!!mysh0rts',
    });

    const pojo = user.toObject();

    expect(Object.keys(pojo).length).toBe(3);
    expect(pojo.isBrilliant).not.toBeDefined();
    expect(pojo.addOne).not.toBeDefined();
    expect(pojo.confirmationPassword).not.toBeDefined();
    expect(pojo.another).not.toBeDefined();
  });

  it('should assign values to transient properties', () => {
    const user = new User({
      name: 'Bart',
      password: 'eat!!!mysh0rts',
      confirmationPassword: 'eat!!!mysh0rts',
      addOne: 6,
      isBrilliant: true,
      another: 'walk',
    });

    expect(user.password).toBe('eat!!!mysh0rts');
    expect(user.confirmationPassword).toBe(user.password);
    expect(user.addOne).toBe(7);
    expect(user.isBrilliant).toBe(true);
    expect(user.another).toBe('modified: walk');
  });

  it('should be able to set values directly', () => {
    const user = new User({
      name: 'Bart',
      password: 'eat!@#myshortzzz',
    });

    user.confirmationPassword = 'eat!@#myshortzzz';
    user.addOne = 2;
    user.isBrilliant = false;
    user.another = 'drink';

    expect(user.confirmationPassword).toBe(user.password);
    expect(user.addOne).toBe(3);
    expect(user.isBrilliant).toBe(false);
    expect(user.another).toBe('modified: drink');
  });

  it('should supply default values if they exist', () => {
    const user = new User();

    expect(user.confirmationPassword).toBeUndefined();
    expect(user.another).toBeUndefined();
    expect(user.addOne).toBeNaN();
    expect(user.isBrilliant).toBe(false);
  });

  it('should run prescribed functions when getting and setting', () => {
    const user = new User({
      addOne: 9,
      another: 'cat',
    });

    expect(user.addOne).toBe(10);
    expect(user.another).toBe('modified: cat');
  });

  it('should not save transient properties', async () => {
    const user = await User.create({
      name: 'Bart',
      password: 'somepassword',
      role: 'user',
      confirmationPassword: 'somepassword',
      addOne: 6,
      another: 'dog',
    });

    const found = (await User.findById(user.id).lean()) as IUser | null;

    expect(found).not.toBeNull();

    const dbUser = found as IUser;
    const dbUserKeys = Object.keys(dbUser);

    expect(dbUserKeys).toHaveLength(5);
    Object.keys(dbUser).forEach((key) => {
      expect(['_id', 'name', 'role', 'password', '__v'].includes(key)).toBe(true);
    });

    expect(dbUser.isBrilliant).toBeUndefined();
    expect(dbUser.addOne).toBeUndefined();
    expect(dbUser.confirmationPassword).toBeUndefined();
    expect(dbUser.another).toBeUndefined();
  });

  it('should be available in hooks', async () => {
    await User.create({
      name: 'Bart',
      password: 'sekurepassword',
      confirmationPassword: 'sekurepassword',
    });

    expect(mockedPreHook).toHaveBeenCalled();
    // One create, one validate. This was 2 while the spy leaked calls from the
    // preceding test; it is 1 now that beforeEach clears it.
    expect(mockedPreHook).toHaveBeenCalledTimes(1);
  });

  it('should invalidate through the hook when the passwords do not match', async () => {
    await expect(
      User.create({
        name: 'Bart',
        password: 'sekurepassword',
        confirmationPassword: 'somethingelse',
      }),
    ).rejects.toThrow('Password and Confirmation Password do not match');
  });

  it('should link transient properties to schema properties', () => {
    const user = new User({
      name: 'Bart',
      role: 'admin',
    });

    expect(user.role).toBe('admin');
    expect(user.description).toBe('The user role is admin');

    user.role = 'moderator';

    expect(user.role).toBe('moderator');
    expect(user.description).toBe('The user role is moderator');

    user.role = 'user';

    expect(user.role).toBe('user');
    expect(user.description).toBe('The user role is user');

    user.role = 'catfish';

    expect(user.role).toBe('catfish');
    expect(user.description).toBe('The user role is invalid');
  });

  it('should handle transient paths whose subpaths vanish with the parent', () => {
    // Removing a Map path takes its `<path>.$*` entry with it. eachPath walks a
    // snapshot of path names but reads each type lazily, so removing during the
    // walk used to hand `undefined` to the next callback and throw.
    const schema = new mongoose.Schema({
      keep: String,
      meta: { type: Map, of: String, transient: true },
    });

    expect(() => transient(schema)).not.toThrow();

    expect(schema.path('meta')).toBeUndefined();
    expect(schema.path('keep')).toBeDefined();
    expect(Object.keys(schema.virtuals)).toContain('meta');
  });

  it('should not link to transient properties', () => {
    // Its own Mongoose instance. Registering the plugin on the shared singleton
    // would apply it to every schema compiled anywhere in the process from then
    // on, and leave a 'Tester' entry in the global model registry -- neither of
    // which this test ever undoes.
    const isolated = new mongoose.Mongoose();

    isolated.plugin(transient);

    const schema = new isolated.Schema({
      testing: String,
      moar: {
        type: String,
        transient: true,
      },
      wat: {
        type: String,
        transient: {
          linkTo: ['testing', 'moar'],
        },
      },
    });

    expect(() => isolated.model('Tester', schema)).toThrow(
      `TransientError: Attempting to link transient property 'wat' to 'moar' which does not exist or is itself transient`,
    );
  });
});
