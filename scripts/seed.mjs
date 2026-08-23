// Catalogue seed.
//
// Loads the sample dealers and vehicles from lib/data.ts into the database, so
// the catalogue tables hold the same rows the app has been rendering. Every row
// is written with is_sample = true and market_value equal to the asking price,
// which is the product's existing honest position: we do not invent a discount.
//
// Idempotent: it refuses to run if any buyer has saved a vehicle, because
// replacing the catalogue would cascade-delete their saved rows.

import { withClient } from './db.mjs'
import { VEHICLES, DEALERS } from '../lib/data.ts'

await withClient(async (c) => {
  const saved = await c.query('select count(*)::int as n from public.saved_vehicles')
  if (saved.rows[0].n > 0) {
    console.log(`refusing to reseed: ${saved.rows[0].n} saved vehicle row(s) reference the catalogue.`)
    process.exit(0)
  }

  await c.query('begin')
  try {
    await c.query('delete from public.cars where is_sample = true')
    await c.query('delete from public.dealers')

    const dealerIds = new Map()
    for (const d of DEALERS) {
      const res = await c.query(
        `insert into public.dealers (name, city, province, brands, website)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [d.name, d.city, d.province, d.brands, d.website],
      )
      dealerIds.set(d.name, res.rows[0].id)
    }

    for (const v of VEHICLES) {
      await c.query(
        `insert into public.cars
           (make, model, variant, year, price, mileage, fuel, transmission,
            city, province, dealer_id, image_url, market_value, is_sample)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)`,
        [
          v.make, v.model, v.variant, v.year, v.price, v.mileage, v.fuel, v.transmission,
          v.city, v.province, dealerIds.get(v.dealer) ?? null, v.image,
          // Market value equals the asking price: no invented discount.
          v.price,
        ],
      )
    }

    await c.query('commit')
  } catch (err) {
    await c.query('rollback')
    throw err
  }

  const counts = await c.query(`
    select
      (select count(*)::int from public.dealers) as dealers,
      (select count(*)::int from public.cars) as cars,
      (select count(*)::int from public.car_specs) as specs
  `)
  const { dealers, cars, specs } = counts.rows[0]
  console.log(`seeded: ${dealers} dealers, ${cars} cars, ${specs} specs`)
  console.log('car_specs is intentionally empty: no specification has a citable source yet.')
})
