import { BytesToString } from "../lib/utils";
import * as chai from 'chai';
const { expect } = chai;

describe('UTILS', () => {
    it('Should correctly decode string', () => {
        const result = BytesToString(Buffer.from('64756D6D795461736B3100000000000000000000000000000000000000000000', 'hex'));
        expect(result).to.equal('dummyTask1');

    }).timeout(10000);
});