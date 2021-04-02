import * as mongoose from 'mongoose';

export interface TransientTypeOpts<T = any> extends mongoose.SchemaTypeOpts<T> {
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
      const opts = setOptions(path, trans);

      schema.remove(path);
      linkPaths(schema, opts);

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
    linkTo,
    path,
    args,
    as,
    get,
    set,
  };
};

const determineLinkTo = (trans: Transience): string[] =>
  isTransientOptions(trans) && trans.linkTo ? asArray(trans.linkTo) : [];

const determineArgs = (trans: Transience): any[] =>
  isTransientOptions(trans) && Array.isArray(trans.args) ? trans.args : [];

const determineGetter = (trans: Transience): TransientCaller =>
  isTransientOptions(trans) && isFunction(trans.get) ? trans.get : defaultCaller;

const determineSetter = (trans: Transience): TransientCaller =>
  isFunction(trans)
    ? trans
    : isTransientOptions(trans) && isFunction(trans.set)
    ? trans.set
    : defaultCaller;

const defaultCaller: TransientCaller = (value: any) => value;

const determinePropertyName = (path: string, trans: Transience): string =>
  isString(trans)
    ? trans
    : isTransientOptions(trans) && isString(trans.as)
    ? trans.as
    : `_${path}`;

const asArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
const isFunction = (value: any): value is TransientCaller =>
  typeof value === 'function';
const isString = (value: any): value is string => typeof value === 'string';
const isTransientOptions = (value: any): value is TransientOptions =>
  value && !Array.isArray(value) && typeof value === 'object';

export default transient;
