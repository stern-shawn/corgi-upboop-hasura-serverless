const fetch = require('node-fetch');
const { hasuraRequest } = require('./util/hasura');

exports.handler = async () => {
  const corgis = await fetch('https://no-cors-api.netlify.app/api/corgis').then(
    (res) => res.json()
  );

  const unsplashPromise = fetch(
    'https://api.unsplash.com/collections/48405776/photos',
    {
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      },
    }
  ).then((res) => res.json());

  const hasuraPromise = hasuraRequest({
    query: `
      mutation InsertOrUpdateBoops($corgis: [boops_insert_input!]!) {
        boops: insert_boops(objects: $corgis, on_conflict: {constraint: boops_pkey, update_columns: id}) {
          returning {
            id
            count
          }
        }
      }
    `,
    variables: {
      // Insert any new corgis to Hasura DB w/ count of 0. If they already exist (conflict)
      // then the actual value in the DB will be returned instead of 0 :)
      corgis: corgis.map(({ id }) => ({ id, count: 0 })),
    },
  });

  const [unsplash, hasuraData] = await Promise.all([
    unsplashPromise,
    hasuraPromise,
  ]);

  const completeData = corgis.map((corgi) => {
    const photo = unsplash.find((p) => p.id === corgi.id);
    const boops = hasuraData.boops.returning.find((b) => b.id === corgi.id);

    return {
      ...corgi,
      alt: photo.alt_description,
      credit: photo.user.name,
      url: `${photo.urls.raw}&auto=format&fit=crop&w=300&h=300&quality=80&crop=entropy`,
      boops: boops.count,
    };
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(completeData),
  };
};
