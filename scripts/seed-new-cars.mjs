// Loads the researched new-car rows into public.new_cars.
// Idempotent: upsert by id, so re-running refreshes prices without duplicates.
import { withClient } from './db.mjs'
import { NEW_CARS, NEW_CAR_SOURCES } from '../lib/new-cars-source.ts'

await withClient(async (c) => {
  await c.query('begin')
  try {
    for (const car of NEW_CARS) {
      const src = NEW_CAR_SOURCES[car.sourceId]
      if (!src) throw new Error(`${car.id} cites unknown source ${car.sourceId}`)
      await c.query(
        `insert into public.new_cars (
           id, make, model, variant, body_type, list_price, fuel, transmission,
           engine_cc, cylinders, power_kw, torque_nm, consumption_l100km,
           tank_litres, seats, boot_litres, ncap_stars, ncap_programme, image_url,
           source_name, source_title, source_url, source_published_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         on conflict (id) do update set
           list_price = excluded.list_price,
           consumption_l100km = excluded.consumption_l100km,
           source_published_at = excluded.source_published_at,
           source_url = excluded.source_url,
           updated_at = now()`,
        [
          car.id, car.make, car.model, car.variant, car.bodyType, car.listPrice, car.fuel,
          car.transmission, car.engineCc, car.cylinders, car.powerKw, car.torqueNm,
          car.consumptionL100km, car.tankLitres, car.seats, car.bootLitres,
          car.ncapStars, car.ncapProgramme, car.imageUrl,
          src.publisher, src.title, src.url, src.publishedAt,
        ],
      )
    }
    await c.query('commit')
  } catch (err) {
    await c.query('rollback')
    throw err
  }

  const stats = await c.query(`
    select count(*)::int as total,
           count(power_kw)::int as with_power,
           count(consumption_l100km)::int as with_consumption,
           count(image_url)::int as with_image,
           min(list_price) as cheapest,
           max(list_price) as dearest
    from public.new_cars
  `)
  const s = stats.rows[0]
  console.log(`new_cars: ${s.total} rows`)
  console.log(`  power figure:       ${s.with_power}/${s.total}`)
  console.log(`  consumption figure: ${s.with_consumption}/${s.total}`)
  console.log(`  photograph held:    ${s.with_image}/${s.total}`)
  console.log(`  price range:        R${s.cheapest} to R${s.dearest}`)
})
