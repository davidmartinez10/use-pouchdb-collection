import { useEffect, useState } from "react";

function all_docs_transform<T>(documents: PouchDB.Core.AllDocsResponse<T>) {
  if (!documents.total_rows) return [];
  return documents.rows.map(function map(e) {
    return e.doc;
  }) as PouchDB.Core.ExistingDocument<T>[];
}

export interface Transform<T, S> {
  (documents: PouchDB.Core.ExistingDocument<T>[]): S;
}

/** Higher-order function that returns a React hook. */
export function create_db_hook<T, TransformType = T[]>(
  database: PouchDB.Database<T>,
  transform?: Transform<T, TransformType>,
) {
  type CallbackReturn = typeof transform extends (
    ...args: never[]
  ) => infer Return ? Return
    : never;
  type HookType = CallbackReturn extends TransformType ? TransformType
    : PouchDB.Core.ExistingDocument<T>[];

  const callbacks = new Set<React.Dispatch<React.SetStateAction<HookType>>>();

  async function fetch_collection() {
    let docs: HookType | PouchDB.Core.ExistingDocument<T>[] =
      all_docs_transform(
        await database.allDocs({ include_docs: true }),
      );
    if (typeof transform === "function") docs = transform(docs);
    for (const cb of callbacks) {
      if (cb) cb(docs as HookType);
    }
  }

  database
    .changes({
      live: true,
      since: "now",
    })
    .on("change", fetch_collection);

  async function upsert(
    o: PouchDB.Core.Document<T> & Partial<PouchDB.Core.RevisionIdMeta>,
    override_rev_requirement = false,
  ): Promise<PouchDB.Core.Response> {
    if (!o._id) {
      throw TypeError(
        "Missing _id property. To insert a new document, include a unique ID.",
      );
    }
    if (override_rev_requirement) {
      o._rev = ((await database.get(o._id).catch()) || {})._rev;
    }
    return database.put(o);
  }

  async function remove(
    o: Partial<T> & PouchDB.Core.IdMeta & PouchDB.Core.RevisionIdMeta,
  ) {
    return database.remove(o);
  }

  /** useCollection hook */
  return function useCollection(): [HookType, typeof upsert, typeof remove] {
    const [docs, set_docs] = useState([] as unknown as HookType);
    callbacks.add(set_docs);

    useEffect(function effect() {
      fetch_collection(); // first load

      return function unmount() {
        callbacks.delete(set_docs);
      };
    }, []);

    return [docs, upsert, remove];
  };
}
