require('dotenv').config();
const ccxt = require('ccxt');
const axios = require('axios');

const run = () => {
  const config = {
    asset: 'BTC',
    base: 'USDT',
    // allocation: 0.001,
    allocation: 11,               //en USDT
    spread: 0.01,
    tickInterval: 60000
  }
  const binanceClient = new ccxt.binance({
    apiKey: process.env.API_KEY,
    secret: process.env.SECRET_KEY
  });
  binanceClient.setSandboxMode(true);
  tick(config, binanceClient);
  setInterval(tick, config.tickInterval, config, binanceClient);
};

const tick = async (config, binanceClient) => {
  const { asset, base, spread, allocation } = config;
  const market = `${asset}/${base}`;
  console.log(`Mercado: ${market}`);

  //Busca órdenes abiertas
  const orders = await binanceClient.fetchOpenOrders(market);
  if (!orders.length) console.log('No hay órdenes')
  else {
    // console.log('Ordenes: ', orders);
    console.log(`Cancela ${orders.length} órdenes abiertas`);
    orders.forEach(order => console.log(`Orden: ${order.id} Mercado: ${order.symbol}`));
    //Cancela órdenes abiertas
    orders.forEach(async order => { 
        await binanceClient.cancelOrder(order.id, order.symbol);
    });
  };

  // Busca precio de mercado promedio en Gecko
  const results = await Promise.all([
    axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'),
    axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd')
  ]);
  const marketPrice = results[0].data.bitcoin.usd / results[1].data.tether.usd;
  console.log(`Precio de mercado: ${marketPrice}`);

  const sellPrice = marketPrice * (1 + spread);
  const buyPrice = marketPrice * (1 - spread);
  const balances = await binanceClient.fetchBalance();
  const assetBalance = balances.free[asset];
  const baseBalance = balances.free[base];
  console.log(`Balance asset/base: ${assetBalance}/${baseBalance}`);
  // const sellVolume = assetBalance * allocation;
  // const buyVolume = (baseBalance * allocation) / marketPrice;

  const sellVolume = allocation/sellPrice;
  const buyVolume = allocation/buyPrice;

  console.log(`Nuevo tick para ${market}...`);
  console.log(`Orden limite de venta por ${sellVolume} @ ${sellPrice}, Notional value = ${sellVolume*sellPrice}`);
  await binanceClient.createLimitSellOrder(market, sellVolume, sellPrice);

  console.log(`Orden limite de compra por ${buyVolume} @ ${buyPrice}, Notional value = ${buyVolume*buyPrice}`);
  await binanceClient.createLimitBuyOrder(market, buyVolume, buyPrice);

  // process.exit(0);

};


run();