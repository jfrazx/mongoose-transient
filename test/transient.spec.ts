import { User, IUser, mockedPreHook } from './lib/user.model';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';
import transient from '../src';

const replSet = new MongoMemoryReplSet({
  replSet: { storageEngine: 'wiredTiger' },
});

describe('Mongoose Transient', () => {
  beforeAll(async () => {
    await replSet.waitUntilRunning();
    const uri = await replSet.getUri();

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
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

  it('should not have virtuals on pojo', () => {
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

    const dbUser = (await User.findById(user.id).lean()) as IUser;
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

    expect(mockedPreHook).toBeCalled();
    expect(mockedPreHook).toBeCalledTimes(2);
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

  it('should not link to transient properties', () => {
    mongoose.plugin(transient);
    const schema = new mongoose.Schema({
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

    expect(() => mongoose.model('Tester', schema)).toThrowError(
      `TransientError: Attempting to link transient property 'wat' to 'moar' which does not exist or is itself transient`,
    );
  });
});
