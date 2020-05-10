import * as mongoose from 'mongoose';

export interface TransientTypeOpts extends mongoose.SchemaTypeOpts<any> {
  transient?: Transience;
}
export type Transience = boolean | string | TransientCaller | TransientOptions;
export type TransientCaller = <T = any>(value: T, ...extra: any[]) => T;
export interface TransientOptions {
  get?: TransientCaller;
  set?: TransientCaller;
  as?: string;
  args?: any[];
  linkTo?: string | string[];
}

interface TransOpts extends Required<Omit<TransientOptions, 'linkTo'>> {
  path: string;
  linkTo: string[];
}

export const transient = (schema: mongoose.Schema<any>): void => {
  schema.eachPath((path, type) => {
    const options = getTypeOpts(type);
    const { transient: trans = false, default: defaultValue } = options;

    if (trans) {
      schema.remove(path);

      const opts = setOptions(path, trans);

      if (opts.linkTo.length) {
        linkPaths(schema, opts);
      }

      schema.virtual(path).get(getter(opts, defaultValue)).set(setter(opts));
    }
  });
};

const getTypeOpts = ({ options }: any): TransientTypeOpts => options;
const linkPaths = (schema: mongoose.Schema<any>, opts: TransOpts): void => {
  function link(this: mongoose.Document, value: any) {
    setter(opts).call(this, value);

    return value;
  }

  opts.linkTo.forEach((linkTo) => {
    try {
      schema.path(linkTo).set(link);
    } catch {
      throw new Error(
        `TransientError: Attempting to link transient property '${opts.path}' to '${linkTo}' which does not exist or is itself transient`,
      );
    }
  });
};

const getter = (opts: TransOpts, defaultValue: any) =>
  function (this: mongoose.Document) {
    const self: any = this;
    const result = opts.get.call(this, self[opts.as], ...opts.args);

    return result ?? defaultValue;
  };

const setter = (opts: TransOpts) =>
  function (this: mongoose.Document, value: any) {
    const self: any = this;
    const result = opts.set.call(this, value, ...opts.args);

    self[opts.as] = result;
  };

const setOptions = (path: string, trans: Transience): TransOpts => {
  const as = determinePropertyName(path, trans);
  const linkTo = determineLinkTo(trans);
  const get = determineGetter(trans);
  const set = determineSetter(trans);
  const args = determineArgs(trans);

  return {
    path,
    as,
    linkTo,
    args,
    get,
    set,
  };
};

const determineLinkTo = (trans: Transience): string[] =>
  typeof trans === 'object' && trans.linkTo ? asArray(trans.linkTo) : [];

const determineArgs = (trans: Transience): any[] =>
  typeof trans === 'object' && Array.isArray(trans.args) ? trans.args : [];

const determineGetter = (trans: Transience): TransientCaller =>
  typeof trans === 'object' && isFunction(trans.get) ? trans.get : defaultCaller;

const determineSetter = (trans: Transience): TransientCaller =>
  isFunction(trans)
    ? trans
    : isObject(trans) && isFunction(trans.set)
    ? trans.set
    : defaultCaller;

const defaultCaller = <T>(value: T) => value;

const determinePropertyName = (path: string, trans: Transience): string =>
  isString(trans)
    ? trans
    : typeof trans === 'object' && isString(trans.as)
    ? trans.as
    : `_${path}`;

const asArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
const isFunction = (value: any): value is Function => typeof value === 'function';
const isString = (value: any): value is string => typeof value === 'string';
const isObject = (value: any): value is object =>
  value && !Array.isArray(value) && typeof value === 'object';

export default transient;
