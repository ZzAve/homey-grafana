import {QuerySyntaxError} from "./QuerySyntaxError";

const corsMiddleware = require('restify-cors-middleware');
import type {Server, Request, Response, Next, RequestHandler} from "restify";

import * as HomeyMetricResolver from "./HomeyMetricResolver";

import * as restify from "restify";

import Debug from "debug";

const debug = Debug("homey-grafana:api");

const cors = corsMiddleware({
    preflightMaxAge: 5,
    origins: ['*'],
    allowHeaders: ['X-App-Version'],
    exposeHeaders: []
});

/**
 * Initialize Server
 */

const getRoot: RequestHandler = (req: Request, res: Response, next: Next) => {
    res.send(200, {});
    next();
};

const searchMetrics = async (req: Request, res: Response, next: Next) => {
    const metrics: any[] = await HomeyMetricResolver.searchMetrics(req.body.target);
    res.send(200, metrics.map(m => m.originalTarget));
    next();
};

const queryMetrics = async (req: Request, res: Response, next: Next) => {
    debug("in QueryMetric");
    try {
        const body = await HomeyMetricResolver.queryMetrics(req.body);
        res.send(200, body);
        next();
    } catch (e) {
        if (e instanceof QuerySyntaxError) {
            res.send(500, {message: (e as QuerySyntaxError).message});
        } else {
            console.error("Unknown, uncaught error occurred: ", e)
            res.send(500, {message: e})
        }
        next()
    }
};

//TODO: implement me
const fetchAnnotations = (req: Request, res: Response, next: Next) => {
    debug("in fetch annotations")
    res.send(200, {});
    next();
};

//TODO: implement me
const getTagKeysForFilters = (req: Request, res: Response, next: Next) => {
    res.send(200, {});
    next();
};

//TODO: implement me
const getTagValuesForFilters = (req: Request, res: Response, next: Next) => {
    res.send(200, {});
    next();
};

const server: Server = restify.createServer();

server.pre(cors.preflight);
server.pre(restify.plugins.pre.dedupeSlashes());
server.use(cors.actual);
server.use(restify.plugins.jsonBodyParser({mapParams: true}));


server.get('/', getRoot);
server.post('/search', searchMetrics);
server.post('/query', queryMetrics);
server.post('/annotations', fetchAnnotations);
server.post('/tag-keys', getTagKeysForFilters);
server.post('/tag-values', getTagValuesForFilters);

server.listen(8080, async () => {
    console.log('%s listening at %s', server.name, server.url);
    await HomeyMetricResolver.getHomey();
    console.log("Connection to Homey is all set up 👍")
});

debug("Server debug info:")
debug(server.getDebugInfo());

