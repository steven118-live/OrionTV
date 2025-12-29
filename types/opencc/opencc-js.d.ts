declare module 'opencc-js' {
  type ConverterFunc = (s: string) => string;
  interface OpenCCModule {
    Converter?: (opts: { from: string; to: string }) => ConverterFunc;
    [key: string]: any;
  }
  const OpenCC: OpenCCModule;
  export default OpenCC;
}
