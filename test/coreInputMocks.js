// Host input contracts for the existing scoped map component fixtures.
const React = require('react');
const {TextField} = require('@material-ui/core');

exports.Autocomplete = ({label,value,options,getOptionLabel,onChange}) => React.createElement(TextField, {
  select:true, fullWidth:true, variant:'standard', label, value:value?.id || '',
  InputLabelProps:{shrink:true}, SelectProps:{native:true}, inputProps:{'aria-label':label},
  onChange:(event)=>onChange(options.find((option)=>option.id===event.target.value)||null),
}, options.map((option)=>React.createElement('option',{key:option.id,value:option.id},getOptionLabel(option))));

exports.TextInput = ({module,label,onChange,...props}) => React.createElement(TextField, {
  ...props, label:label==='filter.findCatchment'?'Find catchment':label,
  onChange:(event)=>onChange(event.target.value),
});
