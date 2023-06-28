/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {Utils} from '@fieldfare/core';

import {v4 as uuidv4 } from 'uuid';

export const inputUUID = {
    type: 'input',
    name: 'uuid',
    message: 'Enter service UUID or leave blank to generate a UUIDv4: ',
    validate(value) {
        if(value == ''
        || Utils.isUUID(value)) {
            return true;
        }
        return 'Please enter a valid UUID';
    },
    filter(value) {
        if(value === '') {
            return uuidv4();
        }
        return value;
    }
}

export const inputWebport = [
    {
        type: 'list',
        name: 'protocol',
        message: "Choose a protocol: ",
        choices: ['ws', 'udp'],
    },
    {
        type: 'input',
        name: 'address',
        message: "Enter destination IPv4: ",
        validate(value) {

            if (Utils.isIPV4(value)) {
                return true;
            }

            return 'Please enter a valid IPv4';
        }
    },
    {
        type: 'input',
        name: 'port',
        message: "Enter port number: ",
        validate(value) {

            if (value > 0
            && value < 65536) {
                return true;
            }

            return 'Please enter a number between 0 and 65536';
        }
    }
];

export const inputIndexBetween = (min, max) => {
    if(min===max) {
        return min;
    } else {
        return {
            type: 'input',
            name: 'index',
            validate(value) {
                if(value !== undefined
                && value !== null
                && value !== '') {
                    const number = parseInt(value);
                    if(value >= min
                    && value <= max) {
                        return true;
                    }
                }
                return "Enter an index between (including) " + min + " and " + max;
            },
            filter(value) {
                return parseInt(value);
            }
        };
    }
}