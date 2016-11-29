'use strict';

let redis = require('redis');
let eventEmitter = require('events');
let child_process = require('child_process');

const UNIT_MAP = {
  week: 7 * 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  min: 60 * 1000,
  s: 1000,
};

class SCHEDULED extends eventEmitter {
  constructor(redisOptions) {
    super();
    let self = this;

    // let redis support subscribe key expired event
    child_process.execSync('redis-cli config set notify-keyspace-events Ex');

    // save eventMap to quene
    self.eventMap = new Map();
    // save scheduled Map
    self.scheduledMap = new Map();
    // save scheduled events Map
    self.scheduledEventMap = new Map();

    redisOptions = Object.assign({
      db: 1,
      prefix: 'scheduled'
    }, redisOptions || {});
    self.options = redisOptions;


    self.redis = redis.createClient(redisOptions);
    self.redis.on('error', e => {
      console.error(e);
    });
    // when redis connected success, check eventMap quene
    self.redis.on('connect', () => {
      if (self.eventMap.size) {
        self.eventMap.forEach((event, key) => {
          typeof event == 'function' && event();
          self.eventMap.delete(key);
        });
      }
    });

    self.on('eventClear', () => {

    });

    self.scheduledRedis = redis.createClient(redisOptions);
    self.scheduledRedis.psubscribe(`__keyevent@${redisOptions.db||1}__:expired`, (e) => {
      console.error(e);
    });
    // when channel publish message, check expire key and event
    self.scheduledRedis.on('pmessage', (channel, listen, key) => {
      let fun = self.scheduledEventMap.get(key);
      (listen == `__keyevent@${self.options.db}__:expired`) && fun && fun(channel, listen, key);
    });

  }

  setScheduled(key, value) {
    let self = this;

    if (self.scheduledMap.get(key))
      return console.error(`key ${key} has been used`);
    return self.scheduledMap.set(key, value);
  }

  /**
   * @keys of options
   * from     timestamp, like 'yyyy/MM/dd (hh:mm:ss)' or 'yyyy-MM-dd (hh:mm:ss)' or msTime
   * repeat   unit s,min,h,day,week
   * name     scheduled name
   */
  every(options, callback) {
    let self = this;

    if (self.scheduledMap.get(options.name) || !options.name)
      return console.error(`task name ${options.name} has been used or cant be null`);

    let from = +new Date(options.from);
    let repeat = options.repeat;

    let unit = repeat.replace(/\d+/g, '');
    if (!UNIT_MAP[unit]) throw new Error('repeat unit only allowed s, min, h, day, week');
    repeat = parseInt(repeat) * UNIT_MAP[unit];

    let eventKey = +new Date + Math.random().toString().substr(2, 4);

    let fun = () => {
      self.redis.set(eventKey, '1', () => {
        self.redis.pexpireat(eventKey, from);
        self.setScheduled(options.name, eventKey);
      });


      self.whenPsubscribeMessage(eventKey, (channel, listen, key) => {
        console.log(key);
        from += repeat;
        self.redis.set(eventKey, '1', () => {
          self.redis.pexpireat(eventKey, from);
        });
        callback();
      });
    };

    if (self.redis.connected) return fun();

    self.eventMap.set(`scheduled${eventKey}`, fun);
  }

  clearEvery(name) {
    let self = this;

    let eventKey = self.scheduledMap.get(name);
    self.redis.del(eventKey, () => {
      self.scheduledEventMap.delete(`${self.options.prefix}${eventKey}`);
      self.scheduledMap.delete(name);
    });
  }

  setTimeout(name, timestamp, callback) {
    let self = this;

    let eventKey = +new Date + Math.random().toString().substr(2, 4);

    let fun = () => {
      self.redis.set(eventKey, '1', () => {
        self.redis.pexpireat(eventKey, +new Date(timestamp));
        self.setScheduled(name, eventKey);
      });

      self.whenPsubscribeMessage(eventKey, (channel, listen, key) => {
        console.log(key);
        callback();
        self.clearTimeout(name);
      });
    };

    if (self.redis.connected) return fun();

    self.eventMap.set(`scheduled${eventKey}`, fun);
  }

  clearTimeout(name) {
    let self = this;

    let eventKey = self.scheduledMap.get(name);
    self.redis.exists(eventKey, (err, exists) => {
      if (exists) self.redis.del(eventKey);
      self.scheduledEventMap.delete(`${self.options.prefix}${eventKey}`);
      self.scheduledMap.delete(name);
    });
  }

  whenPsubscribeMessage(eventKey, callback) {
    let self = this;
    self.scheduledEventMap.set(`${self.options.prefix}${eventKey}`, callback);
  }

}

module.exports = function(options) {
  return new SCHEDULED(options);
};
