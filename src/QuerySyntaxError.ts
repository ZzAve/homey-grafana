export class QuerySyntaxError implements Error {
    message: string;
    name: string = "QuerySyntaxError"
    stack?: string;

    constructor(message: string, stack?: string) {
        this.message = message;
        this.stack = stack
    }
}
