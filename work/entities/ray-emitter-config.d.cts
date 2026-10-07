declare const model: {
 directions: Readonly<Record<string,Readonly<{r:number;c:number;opposite:string;label:string}>>>;
 validate(config: {initialDirection?:unknown}): void;
};
export = model;
