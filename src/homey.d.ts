declare module "homey" {
    declare class AthomApi {
        static _initApi() : Promise<Void>
        static getActiveHomey(): Homey
    }

    export type Homey = {
        insights: InsightsManager
    }

    type InsightsManager = {
        type: string,

        getLogs(): Promise<InsightsLog[]>,
        getLogEntries(options: LogEntryOptions): Promise<LogEntries>
    }

    type InsightsLog = {
        name: string;
        title: string;
        type: string;
        units?: string | undefined;
        decimals?: number | undefined;
    }

    type LogEntries = { values: LogEntry[], step: number }
    type LogEntry = {}
    type LogEntryOptions = { uri: any, id: any, resolution: any }

}
