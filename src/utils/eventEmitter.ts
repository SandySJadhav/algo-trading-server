// get the reference of EventEmitter class of events module
import { EventEmitter } from 'events';

//create an object of EventEmitter class by using above reference
const eventEmitter = new EventEmitter();

//Subscribe to events
eventEmitter.on('FirstEvent', function (data) {
    console.log('First subscriber: ' + data);
});

// Raising FirstEvent
eventEmitter.emit('FirstEvent', 'This is my first Node.js event emitter example.');

export default eventEmitter;