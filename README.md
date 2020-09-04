# Mongoose Transient

Create transient properties on mongoose schemas.

## Basic Usage

```typescript
import { transient } from 'mongoose-transient';
import * as mongoose from 'mongoose';

const { Schema } = mongoose;
const UserSchema = new Schema({
  name: String,
  password: String,
  confirmationPassword: {
    type: String,
    transient: true,
  },
  // other fields....
});

UserSchema.plugin(transient);

export const User = mongoose.model('User', UserSchema);
```

That's it! The `confirmationPassword` field will not be saved to your database but you can still use it on documents and in hooks.

```typescript
function passwordMatchValidation() {
  if (this.isNew || this.isModified('password')) {
    if (this.password !== this.confirmationPassword) {
      this.invalidate('password', 'Password and Confirmation Password do not match');
    }
  }
}

UserSchema.pre('validate', passwordMatchValidation);
```

Any supplied default values will be used if no assignment has occurred.

```typescript
const UserSchema = new Schema({
  isBrilliant: {
    type: Boolean,
    transient: true,
    default: false,
  },
});
```

Types are still required by the Schema.

### Options

For more advanced usage there are a number of options.

Internally a private field is created to store content for transient properties with the default being `_${path}`, e.g. `_confirmationPassword`.
To change this simply set the transient property on your schema to a string you would prefer to use.

```typescript
const UserSchema = new Schema({
  confirmationPassword: {
    type: String,
    transient: 'passwordConfirmation',
  },
});
```

This does not affect your future interactions with your documents, you will still call it by the prescribed path: `this.confirmationPassword`. This is really only necessary to avoid conflict with
mongoose document properties.

You may want to manipulate values before assignment. To do so, set the transient property to a function that accepts the value being set and returns your modified content. Whatever is returned will be assigned to your field.

```typescript
const UserSchema = new Schema({
  name: String,
  password: String,
  modifyMe: {
    type: String,
    transient: function (value: string) {
      return `modified ${value}`;
    },
  },
});
```

The supplied function will be called in the context of the current document.

If you need the full range of options you may pass an object with any of the following properties:

- as: string - As described above, this will set the internal property name for stored content.
- set: Function - As described above, this function allows manipulation of content being assigned.
- get: Function - Similar to `set`, this function allows manipulation of content being retrieved.
- linkTo: string - Adds a link between a transient property and a schema property. Whenever the schema property is updated the transient property is also updated.
- args: any[] - An array of values that will be passed to `get` and `set`. The contents of the array will be spread when passed. `...args`

```typescript
const UserSchema = new Schema({
  name: String,
  password: String,
  role: String,
  confirmationPassword: {
    type: String,
    transient: true,
  },
  modifyMe: {
    type: String,
    transient: function (value: string) {
      return `modified ${value}`;
    },
  },
  isBrilliant: {
    type: Boolean,
    transient: 'isKindaSmrt',
    default: false,
  },
  description: {
    type: String,
    transient: {
      linkTo: 'role',
      as: 'roleDescription',
      args: ['admin', 'moderator', 'user'],
      set: function (role: string, ...roles: string[]) {
        return roles.includes(role) ? role : 'invalid';
      },
      get: function (role: string) {
        return `The user role is ${role}`;
      },
    },
  },
});
```
