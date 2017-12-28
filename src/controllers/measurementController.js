import _ from 'underscore';
import httpStatus from 'http-status';
import { MeasurementModel } from '../models/db/measurement';
import { DeviceModel } from "../models/db/device"
import modelFactory from '../models/db/modelFactory';
import { TimePeriod, CustomTimePeriod } from '../models/request/timePeriod';
import statsCache from '../cache/statsCache';
import responseHandler from '../helpers/responseHandler';
import deviceController from './deviceController';
import constants from '../utils/constants';

 const createMeasurement = async (req, res) => {
    try {
        const newMeasurement = modelFactory.createMeasurement(req.measurement, req);
        const savedMeasurement = await newMeasurement.save();
        await deviceController.createOrUpdateDevice(req.device, savedMeasurement.phenomenonTime, req);
        res.status(httpStatus.CREATED).json(savedMeasurement);
    } catch (err) {
        responseHandler.handleError(res, err);
    }
};

 const getTypes = async (req, res) => {
    try {
        const types = await MeasurementModel.types();
        responseHandler.handleResponse(res, types, constants.typesArrayName);
    } catch (err) {
        responseHandler.handleError(res, err);
    }
};

 const getLastMeasurement = async (req, res) => {
    const type = req.query.type;
    try {
       const lastMeasurements = await MeasurementModel.findLastN(1, type);
       responseHandler.handleResponse(res, _.first(lastMeasurements));
    } catch (err) {
        responseHandler.handleError(res, err);
    }
};

 const getStats = async (req, res) => {
    const type = req.query.type;
    let timePeriod = undefined;
    if (!_.isUndefined(req.query.lastTimePeriod)) {
        timePeriod = new TimePeriod(req.query.lastTimePeriod);
    }
    if (!_.isUndefined(req.query.startDate) || !_.isUndefined(req.query.endDate)) {
        timePeriod = new CustomTimePeriod(req.query.startDate, req.query.endDate)
    }

    try {
        let device;
        if (!_.isUndefined(req.query.device) || !_.isUndefined(req.query.address) ||
                (!_.isUndefined(req.query.longitude) && !_.isUndefined(req.query.latitude))) {
            
            device = await deviceController.getDeviceNameFromRequest(req);
            if (_.isUndefined(device)) {
                return res.sendStatus(httpStatus.NOT_FOUND);
            }
        }

        if (statsCache.cachePolicy(timePeriod)) {
            const statsFromCache = await statsCache.getStatsCache(type, device, timePeriod);
            if (!_.isNull(statsFromCache)) {
                responseHandler.handleResponse(res, statsFromCache, constants.statsArrayName)
            } else {
                const statsFromDB = await getStatsFromDB(type, device, timePeriod);
                statsCache.setStatsCache(type, device, timePeriod, statsFromDB);
                responseHandler.handleResponse(res, statsFromDB, constants.statsArrayName);
            }
        } else {
            const statsFromDB = await getStatsFromDB(type, device, timePeriod);
            responseHandler.handleResponse(res, statsFromDB, constants.statsArrayName);
        }
    } catch (err) {
        responseHandler.handleError(res, err);
    }
};

 const getStatsFromDB = async (type, device, timePeriod) => {
    try {
        return await MeasurementModel.getStats(type, device, timePeriod);
    } catch (err) {
        throw err;
    }
};

export default { createMeasurement, getTypes, getLastMeasurement, getStats };