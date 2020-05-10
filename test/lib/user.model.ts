import * as mongoose from 'mongoose';
import transient from '../../src';

const { Schema } = mongoose;

export const UserSchema = new Schema({
  name: String,
  password: String,
  role: String,
  confirmationPassword: {
    type: String,
    transient: true,
  },
  addOne: {
    type: Number,
    transient: {
      get(value: number) {
        return value + 1;
      },
    },
  },
  isBrilliant: {
    type: Boolean,
    transient: 'isKindaSmrt',
    default: false,
  },
  another: {
    type: String,
    transient: (value: string) => `modified: ${value}`,
  },
  description: {
    type: String,
    transient: {
      as: 'roleDescription',
      args: ['admin', 'moderator', 'user'],
      set: function (value: string, ...roles: string[]) {
        return roles.includes(value) ? value : 'invalid';
      },
      get: function (value: string) {
        return `The user role is ${value}`;
      },
      linkTo: 'role',
    },
  },
});

export interface IUser {
  _id?: any;
  name: string;
  password: string;
  role: string;
  confirmationPassword?: string;
  addOne?: number;
  isBrilliant?: boolean;
  another?: string;
  description?: string;
  __v?: number;
}
export interface UserModel extends IUser, mongoose.Document {
  _id: any;
}
function preHook(this: UserModel) {
  if (this.isNew || this.isModified('password')) {
    if (this.password !== this.confirmationPassword) {
      this.invalidate(
        'password',
        'Password and Confirmation Password do not match',
      );
    }
  }
}
export const mockedPreHook = jest.fn(preHook);

UserSchema.plugin(transient);
UserSchema.pre('validate', mockedPreHook);

export const User = mongoose.model<UserModel>('User', UserSchema);
