buffer+="""
models.unshift(model);\n
var render_#{varname} = function(#{varname}){

}
var render_#{collName} = function(#{collName}#{@eachSeqNo}){
    var buffer = ''
    #{collName}#{@eachSeqNo}.forEach( function(#{varname}){
        buffer += render_#{varname}(#{varname})
    })
    return buffer;
}
var #{collName}#{@eachSeqNo}=model.#{collection};\n"""