'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const Log = require('../src/log')
const EntryIO = require('../src/entry-io')

const apis = [require('ipfs')]

const dataDir = './ipfs/tests/fetch'

let ipfs, ipfsDaemon

const last = (arr) => {
  return arr[arr.length - 1]
}

apis.forEach((IPFS) => {

  describe('Entry - Persistency', function() {
    this.timeout(60000)

    before((done) => {
      rmrf.sync(dataDir)
      ipfs = new IPFS({ 
        repo: dataDir,
        EXPERIMENTAL: {
          pubsub: true
        },
      })
      ipfs.on('error', done)
      ipfs.on('ready', () => done())
    })

    after(() => {
      if (ipfs) 
        ipfs.stop()
    })

    it('log with one entry', async () => {
      let log = new Log(ipfs, 'A')
      await log.append('one')
      const hash = log.values[0].hash
      const res = await EntryIO.fetchAll(ipfs, hash, 1)
      assert.equal(res.length, 1)
    })

    it('log with 2 entries', async () => {
      let log = new Log(ipfs, 'A')
      await log.append('one')
      await log.append('two')
      const hash = last(log.values).hash
      const res = await EntryIO.fetchAll(ipfs, hash, 2)
      assert.equal(res.length, 2)
    })

    it('loads max 1 entriy from a log of 2 entry', async () => {
      let log = new Log(ipfs, 'A')
      await log.append('one')
      await log.append('two')
      const hash = last(log.values).hash
      const res = await EntryIO.fetchAll(ipfs, hash, 1)
      assert.equal(res.length, 1)
    })

    it('log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, 'A')
      for (let i = 0; i < count; i ++)
        await log.append('hello' + i)

      const hash = await log.toMultihash()
      const result = await Log.fromMultihash(ipfs, hash)
      assert.equal(result.length, count)
    })

    it('load only 42 entries from a log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, 'a')
      let log2 = new Log(ipfs, 'b')
      for (let i = 1; i <= count; i ++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          log2 = new Log(ipfs, log2.id, log2.values, log2.heads.concat(log.heads))
          await log2.append('hi' + i)
        }
      }

      const hash = await log.toMultihash()
      const result = await Log.fromMultihash(ipfs, hash, 42)
      assert.equal(result.length, 42)        
    })

    it('load only 99 entries from a log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, 'A')
      let log2 = new Log(ipfs, 'B')
      let log3 = new Log(ipfs, 'C')
      for (let i = 1; i <= count; i ++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          log2 = new Log(ipfs, log2.id, log2.values)
          await log2.append('hi' + i)
          log2.join(log)
        }
      }

      const hash = await log2.toMultihash()
      const result = await Log.fromMultihash(ipfs, hash, 99)
      assert.equal(result.length, 99)
    })

    it('load only 10 entries from a log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, 'A')
      let log2 = new Log(ipfs, 'B')
      let log3 = new Log(ipfs, 'C')
      for (let i = 1; i <= count; i ++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          log2 = new Log(ipfs, log2.id, log2.values, log2.heads)
          await log2.append('hi' + i)
          log2.join(log)
        }
        if (i % 25 === 0) {
          log3 = new Log(ipfs, log3.id, log3.values, log3.heads.concat(log2.heads))
          await log3.append('--' + i)
        }
      }

      log3.join(log2)
      const hash = await log3.toMultihash()
      const result = await Log.fromMultihash(ipfs, hash, 10)
      assert.equal(result.length, 10)
    })

    it('load only 10 entries and then expand to max from a log with 100 entries', async () => {
      const count = 30
      let log =  new Log(ipfs, 'A')
      let log2 = new Log(ipfs, 'B')
      let log3 = new Log(ipfs, 'C')
      for (let i = 1; i <= count; i ++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          await log2.append('hi' + i)
          log2.join(log, -1, log2.id)
        }
        if (i % 25 === 0) {
          log3 = new Log(ipfs, log3.id, log3.values, log3.heads.concat(log2.heads))
          await log3.append('--' + i)
        }
      }

      log3.join(log2)

      const log4 = new Log(ipfs, 'D')
      log4.join(log2)
      log4.join(log3)

      const values3 = log3.values.map((e) => e.payload)
      const values4 = log4.values.map((e) => e.payload)

      assert.deepEqual(values3, values4)
    })
  })
})
