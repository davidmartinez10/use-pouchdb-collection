# use-pouchdb-collection

No dependencies, simple React hook for PouchDB. Designed to be as simple and easy to use as `React.useState()`.
I suggest that you take a look at the source code (it's just under 70 lines of mostly whitespace).

# Usage

This library doesn't export a React hook directly. Instead, it exports a higher order function (`create_db_hook()`) that returns a custom hook.

In this example I created a custom hook and exported it from `db.ts`.

```typescript
// db.ts
import create_db_hook from "use-pouchdb-collection";
import PouchDB from "pouchdb-browser";

interface Customer {
  name: string;
  trusted: boolean;
}

// Optional transform function.
function transform(collection: Customer[]) {
  return collection.sort();
}

export const db_customers = new PouchDB<Customer>();
export const useCollection = create_db_hook(db_customers, transform);
```

Import the custom hook from any number of React functional components. It will seamlessly fire a rerender of each mounted component after every change in the database and will automatically unsubscribe on unmount.

```typescript
// react-component.tsx
import { useCollection } from "db.ts";

function ReactComponent() {
  const [customers, upsertCustomer, removeCustomer] = useCollection();

  function trust(customer) {
    return async function onClick() {
      try {
        await upsertCustomer({ ...customer, trusted: true });
        alert("Success!");
      } catch (err) {
        console.error(err);
      }
    };
  }

  function remove(customer) {
    return async function onClick() {
      try {
        await removeCustomer(customer);
        alert("Success!");
      } catch (err) {
        console.error(err);
      }
    };
  }

  return customers.map(function map(customer) {
    return (
      <div key={customer._id}>
        <p>{customer.name}</p>
        <button onClick={trust(customer)}>Trust</button>
        <button onClick={remove(customer)}>Remove</button>
      </div>
    );
  });
}
```
