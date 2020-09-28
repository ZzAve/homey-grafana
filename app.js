const  restify = require ("restify");
const HomeyMetricResolver = require( "./index.js");
const corsMiddleware = require('restify-cors-middleware');
const Debug = require('debug')

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

console.log(HomeyMetricResolver);

const getRoot = (req, res, next) => {
    res.send(200, {});
    next();
};

const searchMetrics = async (req, res, next) => {
    // console.log(req);
    let metrics = await HomeyMetricResolver.searchMetrics(req.body);
    // console.log(metrics);
    res.send(200, metrics.map(m => m.originalTarget));
    next();
};

const queryMetrics = async (req, res, next) => {
    debug("in QueryMetric");
    // console.log(`Request: ${req}`);
    // console.log(`Request body: ${req.body}`);
    res.send(200, await HomeyMetricResolver.queryMetrics(req.body));
    next();
};

const fetchAnnotations = (req, res, next) => {
   debug("in fetch annotations")
    res.send(200, {});
    next();
};


const getTagKeysForFilters = (req, res, next) => {
    res.send(200, {});
    next();
};

const getTagValuesForFilters = (req, res, next) => {
    res.send(200, {});
    next();
};


const server = restify.createServer();
server.pre(cors.preflight);
server.pre(restify.plugins.pre.dedupeSlashes());
server.use(cors.actual);

// server.use(restify.acceptParser(server.acceptable));
// server.use(restify.jsonp)
server.use(restify.plugins.jsonBodyParser({ mapParams: true }));


server.get('/', getRoot);
server.post('/search', searchMetrics);
server.post('/query', queryMetrics);
server.post('/annotations', fetchAnnotations);
server.post('/tag-keys', getTagKeysForFilters);
server.post('/tag-values', getTagValuesForFilters);


server.listen(8080, async  () => {
    console.log('%s listening at %s', server.name, server.url);
    await HomeyMetricResolver.getHomey();
    console.log("Got homey")
});

// console.log(server.getDebugInfo());

