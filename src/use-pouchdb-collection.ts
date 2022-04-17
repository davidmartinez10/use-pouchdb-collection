import { useState, useEffect } from "react";

function all_docs_transform<T>(documents: PouchDB.Core.AllDocsResponse<T>) {
  if (!documents.total_rows) return [];
  return documents.rows.map(function map(e) {
    return e.doc;
  }) as T[];
}

export interface Transform<T, S = T> {
  (documents: T[]): S[];
}

/** Higher-order function that returns a React hook. */
export function create_db_hook<T>(
  database: PouchDB.Database<T>,
  transform?: Transform<T>
) {
  const callbacks = new Set<React.Dispatch<React.SetStateAction<T[]>>>();

  async function fetch_collection() {
    let docs = all_docs_transform(
      await database.allDocs({ include_docs: true })
    );
    if (typeof transform === "function") docs = transform(docs);
    for (const cb of callbacks) {
      if (cb) cb(docs);
    }
  }

  database
    .changes({
      live: true,
      since: "now",
    })
    .on("change", fetch_collection);

  async function upsert(o: T & { _id?: string; _rev?: string }, override_rev_requirement = false) {
    if (!o._id)
      throw TypeError(
        "Missing _id property. To insert a new document, include a unique ID."
      );
    if (override_rev_requirement) o._rev = (await database.get(o._id).catch() ?? {})._rev;
    return database.put(o);
  }

  async function remove(o: T & { _id?: string; _rev?: string }) {
    return database.remove(
      o as T & (PouchDB.Core.IdMeta & PouchDB.Core.RevisionIdMeta)
    );
  }

  /** useCollection hook */
  return function use_collection(): [T[], typeof upsert, typeof remove] {
    const [docs, set_docs] = useState<T[]>([]);
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
