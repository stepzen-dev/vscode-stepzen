/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import { Kind, TypeNode } from "graphql";
import { logger } from '../logger';
import { GRAPHQL, GraphQLScalarType } from '../../utils/constants';

/**
 * Peels away wrappers (NonNull, List) to get the named type.
 * @param type The GraphQL type node to unwrap
 * @returns The name of the inner named type
 */
export function unwrapType(type: TypeNode): string {
  // Add validation
  if (!type) {
    logger.warn('Null type provided to unwrapType');
    return '';
  }
  
  if (type.kind === Kind.NAMED_TYPE) {
    return type.name.value;
  }
  if (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.LIST_TYPE) {
    return unwrapType(type.type);
  }
  return '';
}

/**
 * Gets the full type string including nullability and list wrappers.
 * @param type The GraphQL type node to analyze
 * @returns The full type string with appropriate wrapping (e.g., "String!", "[Int]", "[User!]!")
 */
export function getFullType(type: TypeNode): string {
  if (!type) {
    logger.warn('Null type provided to getFullType');
    return '';
  }
  
  if (type.kind === Kind.NAMED_TYPE) {
    return type.name.value;
  }
  
  if (type.kind === Kind.LIST_TYPE) {
    return `[${getFullType(type.type)}]`;
  }
  
  if (type.kind === Kind.NON_NULL_TYPE) {
    return `${getFullType(type.type)}!`;
  }
  
  return '';
}

/**
 * Checks if a type is or contains a list type.
 * @param type The GraphQL type node to check
 * @returns True if the type is or contains a list type
 */
export function isListType(type: TypeNode): boolean {
  // Add validation
  if (!type) {
    logger.warn('Null type provided to isListType');
    return false;
  }
  
  if (type.kind === Kind.LIST_TYPE) {
    return true;
  }
  if (type.kind === Kind.NON_NULL_TYPE) {
    return isListType(type.type);
  }
  return false;
}

/**
 * Checks if a type name represents a GraphQL scalar type.
 * @param typeName The name of the type to check
 * @returns True if the type is a scalar type
 */
export function isScalarType(typeName: string): boolean {
  return GRAPHQL.SCALAR_TYPES.includes(typeName as GraphQLScalarType);
} 