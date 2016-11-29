# REDIS-SCHEDULED

[![NPM version][npm-image]][npm-url]

## Support
  redis version must be more than 2.8.0 to support key event subscribe

## Installation
```bash
npm install redis-scheduled --save
```

## Usage
````javascript
var scheduled = require('redis-scheduled')({ db:1, prefix: 'scheduled' });
````

create repeat scheduled
````javascript
scheduled.every({ from: '2016/11/21 10:21:30', repeat: '30min', name: 'myTask'}, callback);
/**
* from    timestamp, like 'yyyy/MM/dd [hh:mm:ss]', 'yyyy-MM-dd [hh:mm:ss]', msTime
* repeat  unit: s, min, h, day, week
* name    scheduled name
*
* scheduled will run every repeat time after from(include from time)
*/
````

destory repeat scheduled
````javascript
scheduled.clearEvery(name);
````

create scheduled task
````javascript
scheduled.setTimeout(name, '2016/11/21 10:21:30', callback);
/**
* scheduled only run once
*/
````
destory scheduled task
````javascript
scheduled.clearTimeout(name);
````


[npm-image]: https://img.shields.io/npm/v/redis-scheduled.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/redis-scheduled
