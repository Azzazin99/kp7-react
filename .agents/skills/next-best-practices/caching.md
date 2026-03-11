# Caching

Next.js 15 introduces significant changes to caching, moving towards a "cache by default" completely opt-in model.

## `fetch` Caching

In Next.js 15, `fetch` requests are **no longer cached by default**. 

To cache a request, you must explicitly pass `cache: 'force-cache'`.

```tsx
// Will NOT be cached (Next.js 15 default)
const res = await fetch('https://api.example.com/data');

// Will be cached
const res = await fetch('https://api.example.com/data', {
  cache: 'force-cache'
});

// Revalidate after 3600 seconds
const res = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 }
});
```

## The `'use cache'` Directive (Experimental)

Next.js 15 introduces the `'use cache'` directive to cache the output of components or functions.

```tsx
// next.config.mjs needs experimental.dynamicIO = true
import { db } from '@/lib/db';

export async function getCachedUsers() {
  'use cache';
  return db.user.findMany();
}

// Or at component level:
export default async function CachedPage() {
  'use cache';
  const data = await getDashboardData();
  return <Dashboard data={data} />;
}
```

## `unstable_cache`

For caching database queries or third-party SDK calls when you can't use `fetch` or `'use cache'`:

```tsx
import { unstable_cache } from 'next/cache';

const getCachedUser = unstable_cache(
  async (id: string) => db.user.findUnique({ where: { id } }),
  ['user-cache-key'], // Cache key parts
  { revalidate: 3600, tags: ['users'] }
);
```

## Route Segment Config

To control caching at the page/layout level:

```tsx
export const dynamic = 'force-dynamic'; // Always render on request
export const revalidate = 3600; // Revalidate every hour
export const fetchCache = 'default-cache';
```

## Revalidation

To invalidate cache, use Server Actions or Route Handlers:

```tsx
import { revalidatePath, revalidateTag } from 'next/cache';

export async function updateData() {
  // Purge specific path
  revalidatePath('/dashboard');
  
  // Purge specific tag
  revalidateTag('users');
}
```
